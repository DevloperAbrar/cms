const prisma = require('../config/prismaClient');
const {
  sendSuccess, sendCreated, sendError, sendNotFound, sendBadRequest, sendForbidden,
} = require('../utils/apiResponse');
const { ROLES } = require('../config/constants');
const { upsertMarks } = require('../services/marks.service');
const { checkQuizConflict, scoreAttempt } = require('../services/quiz.service');
const { parseMarksCSV } = require('../services/csv.service');
const { generateMarksCSVTemplate } = require('../utils/csvTemplateGenerator');
const { saveQuizImage, deleteQuizImage } = require('../services/image.service');
const { getNoticesForUser } = require('../services/notice.service');
const logger = require('../utils/logger');

// Helper: shape user rows to match frontend contract
const mapStudent = (u) => ({
  _id: u.id, id: u.id,
  name: u.name, email: u.email,
  enrollment_number: u.enrollmentNumber,
  section: u.section,
});

exports.getMyStudents = async (req, res) => {
  try {
    const { subject_id } = req.query;
    const subject = await prisma.subject.findUnique({ where: { id: subject_id } });
    if (!subject) return sendNotFound(res, 'Subject not found.');

    const students = await prisma.user.findMany({
      where: { branchId: subject.branchId, year: subject.year, role: 'student', status: 'active' },
      select: { id: true, name: true, email: true, enrollmentNumber: true, section: true },
      orderBy: { name: 'asc' },
    });

    return sendSuccess(res, students.map(mapStudent));
  } catch (err) { return sendError(res, err.message); }
};

exports.getMySubjects = async (req, res) => {
  try {
    const subjects = await prisma.subject.findMany({
      where: { assignedFacultyId: req.user.id },
      include: { branch: { select: { id: true, name: true, code: true } } },
    });
    return sendSuccess(res, subjects.map((s) => ({
      _id: s.id, id: s.id, name: s.name, code: s.code, year: s.year, semester: s.semester,
      type: s.type, credits: s.credits, status: s.status,
      branch_id: s.branch ? { _id: s.branchId, name: s.branch.name, code: s.branch.code } : s.branchId,
    })));
  } catch (err) { return sendError(res, err.message); }
};

exports.getSubFieldConfig = async (req, res) => {
  try {
    const { subject_id, branch_id, year, exam_component_id } = req.query;
    const config = await prisma.marksComponent.findFirst({
      where: { facultyId: req.user.id, subjectId: subject_id, branchId: branch_id, year: Number(year), examComponentId: exam_component_id },
      include: { subFields: true },
    });
    return sendSuccess(res, config ? {
      ...config, _id: config.id,
      sub_fields: config.subFields.map((sf) => ({ _id: sf.id, name: sf.name, max_marks: sf.maxMarks, display_order: sf.displayOrder })),
    } : null);
  } catch (err) { return sendError(res, err.message); }
};

exports.saveSubFieldConfig = async (req, res) => {
  try {
    const { subject_id, branch_id, year, exam_component_id, sub_fields } = req.body;

    const existing = await prisma.marksComponent.findFirst({
      where: { facultyId: req.user.id, subjectId: subject_id, branchId: branch_id, year: Number(year), examComponentId: exam_component_id },
    });

    if (existing?.structureLocked) {
      return sendForbidden(res, 'Sub-field structure is locked after first submission.');
    }

    let config;
    if (existing) {
      await prisma.marksSubField.deleteMany({ where: { marksComponentId: existing.id } });
      config = await prisma.marksComponent.update({
        where: { id: existing.id },
        data: {
          subFields: { create: sub_fields.map((sf, i) => ({ name: sf.name, maxMarks: sf.max_marks, displayOrder: i })) },
        },
        include: { subFields: true },
      });
    } else {
      config = await prisma.marksComponent.create({
        data: {
          collegeId: req.user.collegeId, facultyId: req.user.id, subjectId: subject_id, branchId: branch_id,
          academicSessionId: req.body.academic_session_id || req.user.currentSessionId || 'default',
          year: Number(year), examComponentId: exam_component_id,
          subFields: { create: sub_fields.map((sf, i) => ({ name: sf.name, maxMarks: sf.max_marks, displayOrder: i })) },
        },
        include: { subFields: true },
      });
    }

    return sendSuccess(res, config, 'Sub-field config saved.');
  } catch (err) { return sendError(res, err.message); }
};

exports.getMarksEntries = async (req, res) => {
  try {
    const { subject_id, branch_id, year, semester, exam_component_id } = req.query;

    const students = await prisma.user.findMany({
      where: { branchId: branch_id, year: Number(year), role: 'student', status: 'active' },
      select: { id: true, name: true, enrollmentNumber: true },
      orderBy: { name: 'asc' },
    });

    const marksList = await prisma.marks.findMany({
      where: { subjectId: subject_id, branchId: branch_id, year: Number(year), semester: Number(semester), examComponentId: exam_component_id },
      include: { subFieldEntries: true },
    });

    const marksMap = {};
    for (const m of marksList) marksMap[m.studentId] = m;

    const subFieldConfig = await prisma.marksComponent.findFirst({
      where: { facultyId: req.user.id, subjectId: subject_id, branchId: branch_id, year: Number(year), examComponentId: exam_component_id },
      include: { subFields: { orderBy: { displayOrder: 'asc' } } },
    });

    const result = students.map((s) => ({ ...mapStudent(s), marks: marksMap[s.id] || null }));

    return sendSuccess(res, { students: result, sub_field_config: subFieldConfig });
  } catch (err) { return sendError(res, err.message); }
};

exports.submitMarks = async (req, res) => {
  try {
    const { subject_id, branch_id, year, semester, exam_component_id, entries } = req.body;
    const results = [];
    for (const entry of entries) {
      const marks = await upsertMarks({
        collegeId: req.user.collegeId,
        studentId: entry.student_id,
        subjectId: subject_id,
        branchId: branch_id,
        academicSessionId: entry.academic_session_id || req.body.academic_session_id,
        year: Number(year), semester: Number(semester),
        examComponentId: exam_component_id,
        totalMarks: entry.total_marks, maxMarks: entry.max_marks,
        subFieldEntries: entry.sub_field_entries || [],
        submittedBy: req.user.id,
      });
      results.push(marks);
    }
    return sendSuccess(res, results, 'Marks submitted.');
  } catch (err) {
    if (err.statusCode === 403) return sendForbidden(res, err.message);
    return sendError(res, err.message);
  }
};

exports.downloadMarksTemplate = async (req, res) => {
  try {
    const { subject_id, branch_id, year, exam_component_id } = req.query;
    const students = await prisma.user.findMany({
      where: { branchId: branch_id, year: Number(year), role: 'student', status: 'active' },
      select: { id: true, name: true, enrollmentNumber: true },
    });

    const sfConfig = await prisma.marksComponent.findFirst({
      where: { facultyId: req.user.id, subjectId: subject_id, branchId: branch_id, year: Number(year), examComponentId: exam_component_id },
      include: { subFields: true },
    });

    const buffer = generateMarksCSVTemplate(
      students.map((s) => ({ ...s, enrollment_number: s.enrollmentNumber })),
      sfConfig?.subFields?.map((sf) => ({ ...sf, max_marks: sf.maxMarks })) || []
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="marks_template.csv"');
    return res.send(buffer);
  } catch (err) { return sendError(res, err.message); }
};

exports.uploadMarksCSV = async (req, res) => {
  try {
    if (!req.file) return sendBadRequest(res, 'CSV file required.');
    const { subject_id, branch_id, year, semester, exam_component_id } = req.body;
    const rows = await parseMarksCSV(req.file.buffer);

    const students = await prisma.user.findMany({
      where: { branchId: branch_id, year: Number(year), role: 'student' },
      select: { id: true, enrollmentNumber: true },
    });

    const enrollMap = {};
    for (const s of students) enrollMap[s.enrollmentNumber] = s.id;

    const errors = [];
    const results = [];

    for (const row of rows) {
      const studentId = enrollMap[row.enrollment_no];
      if (!studentId) { errors.push({ enrollment_no: row.enrollment_no, error: 'Student not found' }); continue; }
      try {
        const marks = await upsertMarks({
          collegeId: req.user.collegeId, studentId, subjectId: subject_id, branchId: branch_id,
          academicSessionId: req.body.academic_session_id,
          year: Number(year), semester: Number(semester), examComponentId: exam_component_id,
          totalMarks: row.marks_obtained, maxMarks: row.max_marks,
          subFieldEntries: row.sub_field_entries || [], submittedBy: req.user.id,
        });
        results.push(marks);
      } catch (e) { errors.push({ enrollment_no: row.enrollment_no, error: e.message }); }
    }

    return sendSuccess(res, { imported: results.length, errors }, 'CSV marks processed.');
  } catch (err) { return sendError(res, err.message); }
};

exports.getMyQuizzes = async (req, res) => {
  try {
    const quizzes = await prisma.quiz.findMany({
      where: { createdById: req.user.id },
      include: { subject: { select: { id: true, name: true, code: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return sendSuccess(res, quizzes.map((q) => ({
      ...q, _id: q.id,
      subject_id: q.subject ? { _id: q.subjectId, name: q.subject.name, code: q.subject.code } : q.subjectId,
    })));
  } catch (err) { return sendError(res, err.message); }
};

exports.createQuiz = async (req, res) => {
  try {
    const { title, subject_id, branch_id, year, start_time, end_time, duration_minutes,
      total_marks, negative_marking, negative_value, shuffle_questions, shuffle_options,
      attempts_allowed, result_visibility, academic_session_id } = req.body;

    const quiz = await prisma.quiz.create({
      data: {
        collegeId: req.user.collegeId, title, subjectId: subject_id, branchId: branch_id,
        academicSessionId: academic_session_id, year, createdById: req.user.id,
        startTime: new Date(start_time), endTime: new Date(end_time),
        durationMinutes: duration_minutes, totalMarks: total_marks,
        negativeMarking: negative_marking || false, negativeValue: negative_value || 0,
        shuffleQuestions: shuffle_questions || false, shuffleOptions: shuffle_options || false,
        attemptsAllowed: attempts_allowed || 1, resultVisibility: result_visibility || 'immediate',
        status: 'draft',
      },
    });
    return sendCreated(res, { ...quiz, _id: quiz.id }, 'Quiz created as draft.');
  } catch (err) { return sendError(res, err.message); }
};

exports.updateQuiz = async (req, res) => {
  try {
    const quiz = await prisma.quiz.findFirst({ where: { id: req.params.id, createdById: req.user.id } });
    if (!quiz) return sendNotFound(res, 'Quiz not found.');
    if (quiz.status === 'published') return sendForbidden(res, 'Cannot edit a published quiz.');

    const updated = await prisma.quiz.update({
      where: { id: req.params.id },
      data: {
        title: req.body.title,
        startTime: req.body.start_time ? new Date(req.body.start_time) : undefined,
        endTime: req.body.end_time ? new Date(req.body.end_time) : undefined,
        durationMinutes: req.body.duration_minutes,
        totalMarks: req.body.total_marks,
        negativeMarking: req.body.negative_marking,
        negativeValue: req.body.negative_value,
        shuffleQuestions: req.body.shuffle_questions,
        shuffleOptions: req.body.shuffle_options,
        attemptsAllowed: req.body.attempts_allowed,
        resultVisibility: req.body.result_visibility,
      },
    });
    return sendSuccess(res, { ...updated, _id: updated.id }, 'Quiz updated.');
  } catch (err) { return sendError(res, err.message); }
};

exports.publishQuiz = async (req, res) => {
  try {
    const quiz = await prisma.quiz.findFirst({ where: { id: req.params.id, createdById: req.user.id } });
    if (!quiz) return sendNotFound(res);

    const conflict = await checkQuizConflict(quiz.branchId, quiz.year, quiz.startTime, quiz.endTime, quiz.id);
    if (conflict) {
      return sendBadRequest(res, `Quiz conflicts with "${conflict.title}" (${conflict.startTime} – ${conflict.endTime}). Adjust your time window.`);
    }

    await prisma.quiz.update({ where: { id: quiz.id }, data: { status: 'published' } });
    return sendSuccess(res, null, 'Quiz published.');
  } catch (err) { return sendError(res, err.message); }
};

exports.deleteQuiz = async (req, res) => {
  try {
    const quiz = await prisma.quiz.findFirst({
      where: { id: req.params.id, createdById: req.user.id },
      include: { questions: { include: { options: true } } },
    });
    if (!quiz) return sendNotFound(res);

    for (const q of quiz.questions) {
      if (q.imagePath) deleteQuizImage(q.imagePath);
      for (const opt of q.options) { if (opt.imagePath) deleteQuizImage(opt.imagePath); }
    }

    await prisma.quiz.delete({ where: { id: quiz.id } });
    return sendSuccess(res, null, 'Quiz deleted.');
  } catch (err) { return sendError(res, err.message); }
};

exports.uploadQuizImage = async (req, res) => {
  try {
    if (!req.file) return sendBadRequest(res, 'Image file required.');
    const questionId = req.params.questionId || `q_${Date.now()}`;
    const path = await saveQuizImage(req.file.buffer, questionId);
    return sendSuccess(res, { image_path: path }, 'Image uploaded.');
  } catch (err) { return sendError(res, err.message); }
};

exports.getQuizResults = async (req, res) => {
  try {
    const quiz = await prisma.quiz.findFirst({ where: { id: req.params.id, createdById: req.user.id } });
    if (!quiz) return sendNotFound(res);

    const attempts = await prisma.quizAttempt.findMany({
      where: { quizId: req.params.id, submittedAt: { not: null } },
      include: { student: { select: { id: true, name: true, enrollmentNumber: true } } },
      orderBy: { score: 'desc' },
    });

    return sendSuccess(res, {
      quiz: { title: quiz.title, total_marks: quiz.totalMarks },
      attempts: attempts.map((a) => ({
        ...a, _id: a.id,
        student_id: a.student ? { _id: a.studentId, name: a.student.name, enrollment_number: a.student.enrollmentNumber } : a.studentId,
        submitted_at: a.submittedAt, is_auto_submitted: a.isAutoSubmitted,
      })),
    });
  } catch (err) { return sendError(res, err.message); }
};

exports.postNotice = async (req, res) => {
  try {
    const { title, body, priority, target_type, target_ids, schedule_at, expires_at } = req.body;
    const notice = await prisma.notice.create({
      data: {
        collegeId: req.user.collegeId, title, body,
        priority: priority || 'normal',
        targetType: target_type,
        targetIds: Array.isArray(target_ids) ? target_ids.map(String) : [String(target_ids)],
        scheduleAt: schedule_at ? new Date(schedule_at) : null,
        expiresAt: expires_at ? new Date(expires_at) : null,
        postedById: req.user.id,
      },
    });
    return sendCreated(res, { ...notice, _id: notice.id }, 'Notice posted.');
  } catch (err) { return sendError(res, err.message); }
};

exports.getNotices = async (req, res) => {
  try {
    const notices = await getNoticesForUser(req.user);
    return sendSuccess(res, notices);
  } catch (err) { return sendError(res, err.message); }
};

exports.sendMessage = async (req, res) => {
  try {
    const { recipient_id, body } = req.body;
    const msg = await prisma.message.create({
      data: { collegeId: req.user.collegeId, senderId: req.user.id, recipientId: recipient_id, body },
    });
    return sendCreated(res, { ...msg, _id: msg.id }, 'Message sent.');
  } catch (err) { return sendError(res, err.message); }
};

exports.getMessages = async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: {
        OR: [{ senderId: req.user.id }, { recipientId: req.user.id }],
      },
      include: {
        sender: { select: { name: true, role: true } },
        recipient: { select: { name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return sendSuccess(res, messages.map((m) => ({
      ...m, _id: m.id,
      sender_id: { _id: m.senderId, name: m.sender?.name, role: m.sender?.role },
      recipient_id: { _id: m.recipientId, name: m.recipient?.name, role: m.recipient?.role },
    })));
  } catch (err) { return sendError(res, err.message); }
};

exports.getAttendanceByDate = async (req, res) => {
  try {
    const { subject_id, date } = req.query;
    const subject = await prisma.subject.findFirst({ where: { id: subject_id, assignedFacultyId: req.user.id } });
    if (!subject) return sendForbidden(res, 'Subject not assigned to you.');

    const students = await prisma.user.findMany({
      where: { branchId: subject.branchId, year: subject.year, role: 'student', status: 'active' },
      select: { id: true, name: true, enrollmentNumber: true, section: true },
      orderBy: { name: 'asc' },
    });

    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const existing = await prisma.attendance.findMany({
      where: { subjectId: subject_id, date: { gte: dayStart, lte: dayEnd } },
    });

    const attendanceMap = {};
    for (const a of existing) attendanceMap[a.studentId] = a.status;

    const result = students.map((s) => ({
      ...mapStudent(s),
      status: attendanceMap[s.id] || 'present',
    }));

    return sendSuccess(res, result);
  } catch (err) { return sendError(res, err.message); }
};

exports.submitAttendance = async (req, res) => {
  try {
    const { subject_id, date, slot, entries } = req.body;
    const subject = await prisma.subject.findFirst({ where: { id: subject_id, assignedFacultyId: req.user.id } });
    if (!subject) return sendForbidden(res, 'Subject not assigned to you.');

    const attendanceDate = new Date(date);

    await prisma.$transaction(
      entries.map((e) =>
        prisma.attendance.upsert({
          where: { studentId_subjectId_date: { studentId: e.student_id, subjectId: subject_id, date: attendanceDate } },
          update: { status: e.status, slot: slot || null, markedById: req.user.id },
          create: {
            collegeId: req.user.collegeId, studentId: e.student_id, subjectId: subject_id,
            branchId: subject.branchId, year: subject.year,
            academicSessionId: req.body.academic_session_id || 'default',
            date: attendanceDate, slot: slot || null, status: e.status, markedById: req.user.id,
          },
        })
      )
    );

    return sendSuccess(res, null, 'Attendance saved.');
  } catch (err) { return sendError(res, err.message); }
};

exports.getAttendanceSummary = async (req, res) => {
  try {
    const { subject_id } = req.query;
    const subject = await prisma.subject.findFirst({ where: { id: subject_id, assignedFacultyId: req.user.id } });
    if (!subject) return sendForbidden(res, 'Subject not assigned to you.');

    const students = await prisma.user.findMany({
      where: { branchId: subject.branchId, year: subject.year, role: 'student', status: 'active' },
      select: { id: true, name: true, enrollmentNumber: true },
      orderBy: { name: 'asc' },
    });

    const records = await prisma.attendance.findMany({ where: { subjectId: subject_id } });

    const summary = {};
    for (const s of students) {
      summary[s.id] = { ...mapStudent(s), total: 0, present: 0, absent: 0, late: 0 };
    }
    for (const r of records) {
      if (summary[r.studentId]) {
        summary[r.studentId].total++;
        summary[r.studentId][r.status]++;
      }
    }

    const result = Object.values(summary).map((s) => ({
      ...s,
      percentage: s.total > 0 ? Math.round((s.present / s.total) * 100) : 0,
    }));

    return sendSuccess(res, result);
  } catch (err) { return sendError(res, err.message); }
};

exports.getExamPattern = async (req, res) => {
  try {
    const { subject_id, semester } = req.query;
    if (!subject_id || !semester) return sendBadRequest(res, 'subject_id and semester are required.');

    const subject = await prisma.subject.findUnique({
      where: { id: subject_id },
      include: { branch: { include: { department: { include: { stream: true } } } } },
    });
    if (!subject) return sendNotFound(res, 'Subject not found.');

    const streamId = subject.branch?.department?.streamId;
    if (!streamId) return sendNotFound(res, 'Stream not found for subject.');

    const pattern = await prisma.examPattern.findFirst({
      where: { streamId, year: subject.year, semester: Number(semester) },
      include: { components: true },
    });

    if (!pattern) return sendNotFound(res, 'No exam pattern found for this subject + semester.');

    return sendSuccess(res, {
      ...pattern, _id: pattern.id,
      stream_id: streamId,
      components: pattern.components.map((c) => ({
        _id: c.id, id: c.id, name: c.name, max_marks: c.maxMarks,
        weightage_percent: c.weightagePercent, entered_by: c.enteredBy,
        include_in_sgpa: c.includeInSgpa, pass_marks: c.passMarks,
      })),
    });
  } catch (err) { return sendError(res, err.message); }
};

exports.getMarksLockStatus = async (req, res) => {
  try {
    const { subject_id, branch_id, year, exam_component_id } = req.query;
    const lockedRecord = await prisma.marks.findFirst({
      where: { subjectId: subject_id, branchId: branch_id, year: Number(year), examComponentId: exam_component_id, locked: true },
    });
    return sendSuccess(res, { locked: !!lockedRecord });
  } catch (err) { return sendError(res, err.message); }
};

exports.publishResults = async (req, res) => {
  try {
    const { mode } = req.body;
    const { RESULT_PUBLISH_MODE } = require('../config/constants');
    const allowed = Object.values(RESULT_PUBLISH_MODE).filter((m) => m !== RESULT_PUBLISH_MODE.NONE);
    if (!allowed.includes(mode)) return sendBadRequest(res, `Invalid mode. Choose: ${allowed.join(', ')}`);

    const quiz = await prisma.quiz.findFirst({ where: { id: req.params.id, createdById: req.user.id } });
    if (!quiz) return sendNotFound(res, 'Quiz not found.');

    await prisma.quiz.update({ where: { id: quiz.id }, data: { resultPublishMode: mode } });
    return sendSuccess(res, { result_publish_mode: mode }, 'Results published to students.');
  } catch (err) { return sendError(res, err.message); }
};

exports.exportAttendanceSummary = async (req, res) => {
  try {
    const { subject_id } = req.query;
    const subject = await prisma.subject.findFirst({ where: { id: subject_id, assignedFacultyId: req.user.id } });
    if (!subject) return sendForbidden(res, 'Subject not assigned to you.');

    const students = await prisma.user.findMany({
      where: { branchId: subject.branchId, year: subject.year, role: 'student', status: 'active' },
      select: { id: true, name: true, enrollmentNumber: true },
      orderBy: { name: 'asc' },
    });

    const records = await prisma.attendance.findMany({ where: { subjectId: subject_id } });

    const summary = {};
    for (const s of students) summary[s.id] = { name: s.name, enrollment_number: s.enrollmentNumber, total: 0, present: 0, absent: 0, late: 0 };
    for (const r of records) {
      if (summary[r.studentId]) { summary[r.studentId].total++; summary[r.studentId][r.status]++; }
    }

    const rows = Object.values(summary).map((s) => ({
      ...s, percentage: s.total > 0 ? Math.round((s.present / s.total) * 100) : 0,
    }));

    const header = 'Name,Enrollment,Total,Present,Absent,Late,Percentage\n';
    const csv = header + rows.map((r) =>
      `${r.name},${r.enrollment_number},${r.total},${r.present},${r.absent},${r.late},${r.percentage}%`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="attendance_summary.csv"');
    return res.send(csv);
  } catch (err) { return sendError(res, err.message); }
};


exports.getFinalResultBranches = async (req, res) => {
  try {
    const branches = await prisma.branch.findMany({
      where: { departmentId: req.user.departmentId },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
    return sendSuccess(res, branches.map((b) => ({ _id: b.id, ...b })));
  } catch (err) { return sendError(res, err.message); }
};