const User = require('../models/User');
const Marks = require('../models/Marks');
const Notice = require('../models/Notice');
const ExamPattern = require('../models/ExamPattern');
const FinalResult = require('../models/FinalResult');
const FinalResultConfig = require('../models/FinalResultConfig');
const { verifyParentToken } = require('../services/parentToken.service');
const {
  getStudentSubjectAttendance,
  getStudentOverallAttendance,
  getStudentMonthlyAttendance,
  getStudentWeeklyAttendance,       // ← NEW
} = require('../services/attendance.service');
const { calculateSGPA, calculateCGPA } = require('../services/grade.service'); // ← NEW
const { sendSuccess, sendError, sendUnauthorized, sendNotFound } = require('../utils/apiResponse');
const { NOTICE_TARGET_TYPE } = require('../config/constants');
const logger = require('../utils/logger');

/**
 * GET /parent/:token
 * Public endpoint — no auth required.
 * Verifies JWT parent token and returns student summary.
 */
exports.getParentView = async (req, res) => {
  try {
    const { token } = req.params;

    const { valid, studentId, error } = await verifyParentToken(token);
    if (!valid) {
      return sendUnauthorized(res, error || 'Invalid or expired parent link.');
    }

    // ── Student profile ──────────────────────────────────────────────────────
    const student = await User.findById(studentId)
      .populate('branch_id', 'name code')
      .populate('department_id', 'name code')
      .select('name email enrollment_number year section semester branch_id department_id stream_id')
      .lean();

    if (!student) return sendNotFound(res, 'Student not found.');

    // ── Attendance (parallel) ────────────────────────────────────────────────
    const [subjectAttendance, overallAttendance, monthlyAttendance, weeklyAttendance] =
      await Promise.all([
        getStudentSubjectAttendance(studentId),
        getStudentOverallAttendance(studentId),
        getStudentMonthlyAttendance(studentId, 6),
        getStudentWeeklyAttendance(studentId, 8),   // ← NEW
      ]);

    // ── Marks ────────────────────────────────────────────────────────────────
    const marksList = await Marks.find({ student_id: studentId })
      .populate('subject_id', 'name code')
      .lean();

    // Resolve component names from ExamPattern
    let componentNameMap = {};
    if (student.stream_id && student.year && student.semester) {
      const examPattern = await ExamPattern.findOne({
        stream_id: student.stream_id,
        year: student.year,
        semester: student.semester,
      })
        .select('components')
        .lean();

      if (examPattern?.components?.length) {
        componentNameMap = examPattern.components.reduce((map, c) => {
          map[c._id.toString()] = {
            name: c.name,
            weightage_percent: c.weightage_percent,
          };
          return map;
        }, {});
      }
    }

    // Group marks by subject
    const marksBySubject = {};
    for (const m of marksList) {
      const key = m.subject_id?._id?.toString();
      if (!key) continue;
      if (!marksBySubject[key]) {
        marksBySubject[key] = {
          subject_name: m.subject_id.name,
          subject_code: m.subject_id.code,
          components: [],
        };
      }
      const compMeta = componentNameMap[m.exam_component_id?.toString()];
      marksBySubject[key].components.push({
        exam_component_id: m.exam_component_id,
        component_name: compMeta?.name || null,
        weightage_percent: compMeta?.weightage_percent ?? null,
        total_marks: m.total_marks,
        max_marks: m.max_marks,
        locked: m.locked,
      });
    }

    // ── Grades: SGPA + CGPA ──────────────────────────────────────────────────
    // Only attempt if the student has stream_id (needed by grade.service)
    let grades = null;
    if (student.stream_id && student.year && student.semester) {
      try {
        const [sgpaResult, cgpaResult] = await Promise.all([
          calculateSGPA(studentId, student.stream_id, student.year, student.semester),
          calculateCGPA(studentId, student.stream_id, student.year),
        ]);

        // Build semester-wise SGPA list from CGPA semesters array
        // so the frontend GradeCard can show a sparkline/scroll
        grades = {
          sgpa: sgpaResult.sgpa !== null
            ? {
                sgpa: sgpaResult.sgpa,
                // map component breakdown if useful (optional, front-end may ignore)
                components: cgpaResult.semesters, // [{year, semester, sgpa}]
              }
            : null,
          cgpa: cgpaResult.cgpa !== null
            ? { cgpa: cgpaResult.cgpa }
            : null,
        };
      } catch (gradeErr) {
        // Non-fatal — grades simply won't appear in parent view
        logger.warn(`Grade calculation failed for student ${studentId}: ${gradeErr.message}`);
        grades = null;
      }
    }

    // ── Final Results (published only) ───────────────────────────────────────
    let finalResults = [];
    try {
      const rawResults = await FinalResult.find({
        student_id: studentId,
        is_published: true,
      })
        .populate('config_id', 'name metric_type')   // FinalResultConfig fields
        .sort({ semester: 1 })
        .lean();

      finalResults = rawResults.map((r) => ({
        _id: r._id,
        config_name: r.config_id?.name || 'Result',
        metric_type: r.config_id?.metric_type || null,  // e.g. "SGPA", "CGPA", "Percentage"
        semester: r.semester,
        year: r.year,
        value: r.value,
        published_at: r.published_at,
      }));
    } catch (frErr) {
      // Non-fatal
      logger.warn(`Final results fetch failed for student ${studentId}: ${frErr.message}`);
    }

    // ── Notices ──────────────────────────────────────────────────────────────
    const now = new Date();
    const notices = await Notice.find({
      $or: [
        { target_type: NOTICE_TARGET_TYPE.ALL },
        { target_type: NOTICE_TARGET_TYPE.BRANCH, target_ids: student.branch_id?._id },
        { target_type: NOTICE_TARGET_TYPE.DEPARTMENT, target_ids: student.department_id?._id },
        { target_type: NOTICE_TARGET_TYPE.INDIVIDUAL, target_ids: studentId },
      ],
      $and: [
        { $or: [{ schedule_at: null }, { schedule_at: { $lte: now } }] },
        { $or: [{ expires_at: null }, { expires_at: { $gte: now } }] },
      ],
    })
      .select('title body priority created_at')
      .sort({ created_at: -1 })
      .limit(10)
      .lean();

    // ── Response ─────────────────────────────────────────────────────────────
    return sendSuccess(res, {
      student: {
        name: student.name,
        enrollment_number: student.enrollment_number,
        branch: student.branch_id?.name,
        branch_code: student.branch_id?.code,
        year: student.year,
        section: student.section,
        semester: student.semester,
      },
      attendance: {
        overall: overallAttendance,
        subject_wise: subjectAttendance,
        monthly: monthlyAttendance,
        weekly: weeklyAttendance,           // ← NEW
      },
      marks: Object.values(marksBySubject),
      grades,                               // ← NEW  (null if unavailable)
      final_results: finalResults,          // ← NEW  ([] if none published)
      recent_notices: notices,
    });
  } catch (err) {
    logger.error(`Parent view error: ${err.message}`);
    return sendError(res, 'Failed to load parent view.');
  }
};