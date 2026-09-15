const prisma = require('../config/prismaClient');
const { verifyParentToken } = require('../services/parentToken.service');
const { getStudentSubjectAttendance, getStudentOverallAttendance, getStudentMonthlyAttendance, getStudentWeeklyAttendance } = require('../services/attendance.service');
const { calculateSGPA, calculateCGPA } = require('../services/grade.service');
const { sendSuccess, sendError, sendUnauthorized, sendNotFound } = require('../utils/apiResponse');
const logger = require('../utils/logger');

exports.getParentView = async (req, res) => {
  try {
    const { token } = req.params;
    const { valid, studentId, error } = await verifyParentToken(token);
    if (!valid) return sendUnauthorized(res, error || 'Invalid or expired parent link.');

    const student = await prisma.user.findUnique({
      where: { id: studentId },
      include: { branch: { include: { department: true } } },
    });
    if (!student) return sendNotFound(res, 'Student not found.');

    const [subjectAttendance, overallAttendance, monthlyAttendance, weeklyAttendance] = await Promise.all([
      getStudentSubjectAttendance(studentId),
      getStudentOverallAttendance(studentId),
      getStudentMonthlyAttendance(studentId, 6),
      getStudentWeeklyAttendance(studentId, 8),
    ]);

    const marksList = await prisma.marks.findMany({
      where: { studentId },
      include: { subject: { select: { id: true, name: true, code: true } } },
    });

    const streamId = student.branch?.department?.streamId;
    let componentNameMap = {};
    if (streamId && student.year && student.semester) {
      const examPattern = await prisma.examPattern.findFirst({
        where: { streamId, year: student.year, semester: student.semester },
        include: { components: true },
      });
      if (examPattern?.components?.length) {
        componentNameMap = examPattern.components.reduce((map, c) => {
          map[c.id] = { name: c.name, weightage_percent: c.weightagePercent };
          return map;
        }, {});
      }
    }

    const marksBySubject = {};
    for (const m of marksList) {
      const key = m.subjectId;
      if (!key) continue;
      if (!marksBySubject[key]) {
        marksBySubject[key] = { subject_name: m.subject?.name, subject_code: m.subject?.code, components: [] };
      }
      const compMeta = componentNameMap[m.examComponentId];
      marksBySubject[key].components.push({
        exam_component_id: m.examComponentId, component_name: compMeta?.name || null,
        weightage_percent: compMeta?.weightage_percent ?? null, total_marks: m.totalMarks, max_marks: m.maxMarks, locked: m.locked,
      });
    }

    let grades = null;
    if (streamId && student.year && student.semester) {
      try {
        const [sgpaResult, cgpaResult] = await Promise.all([
          calculateSGPA(studentId, streamId, student.year, student.semester),
          calculateCGPA(studentId, streamId, student.year),
        ]);
        grades = {
          sgpa: sgpaResult.sgpa !== null ? { sgpa: sgpaResult.sgpa, components: cgpaResult.semesters } : null,
          cgpa: cgpaResult.cgpa !== null ? { cgpa: cgpaResult.cgpa } : null,
        };
      } catch (gradeErr) {
        logger.warn(`Grade calculation failed for student ${studentId}: ${gradeErr.message}`);
      }
    }

    const finalResults = await prisma.finalResult.findMany({
      where: { studentId, isPublished: true },
      include: { config: { select: { label: true, metricType: true } } },
      orderBy: { semester: 'asc' },
    });

    const now = new Date();
    const notices = await prisma.notice.findMany({
      where: {
        collegeId: student.collegeId,
        OR: [
          { targetType: 'all' },
          { targetType: 'branch', targetIds: { has: student.branchId } },
          { targetType: 'department', targetIds: { has: student.departmentId } },
          { targetType: 'individual', targetIds: { has: studentId } },
        ],
        AND: [
          { OR: [{ scheduleAt: null }, { scheduleAt: { lte: now } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
        ],
      },
      select: { id: true, title: true, body: true, priority: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return sendSuccess(res, {
      student: {
        name: student.name, enrollment_number: student.enrollmentNumber,
        branch: student.branch?.name, branch_code: student.branch?.code,
        year: student.year, section: student.section, semester: student.semester,
      },
      attendance: { overall: overallAttendance, subject_wise: subjectAttendance, monthly: monthlyAttendance, weekly: weeklyAttendance },
      marks: Object.values(marksBySubject),
      grades,
      final_results: finalResults.map((r) => ({
        _id: r.id, config_name: r.config?.label || 'Result', metric_type: r.config?.metricType || null,
        semester: r.semester, year: r.year, value: r.value, published_at: r.publishedAt,
      })),
      recent_notices: notices.map((n) => ({ ...n, _id: n.id, created_at: n.createdAt })),
    });
  } catch (err) {
    logger.error(`Parent view error: ${err.message}`);
    return sendError(res, 'Failed to load parent view.');
  }
};