const prisma = require('../config/prismaClient');
const { sendSuccess, sendCreated, sendError, sendNotFound, sendBadRequest, sendForbidden } = require('../utils/apiResponse');
const { ROLES } = require('../config/constants');
const { lockComponent, unlockComponent } = require('../services/marks.service');
const { getStudentSubjectAttendance, getStudentOverallAttendance, getBranchDefaulters } = require('../services/attendance.service');
const { generateParentToken, revokeParentToken } = require('../services/parentToken.service');
const { getNoticesForUser } = require('../services/notice.service');
const logger = require('../utils/logger');

const mapUser = (u) => ({
  _id: u.id, id: u.id, name: u.name, email: u.email, role: u.role,
  enrollment_number: u.enrollmentNumber, section: u.section, year: u.year,
  branch_id: u.branchId, department_id: u.departmentId,
});

exports.getTimetable = async (req, res) => {
  try {
    const { branch_id, year, semester, academic_session_id } = req.query;
    const timetable = await prisma.timetable.findFirst({
      where: { branchId: branch_id, year: Number(year), semester: Number(semester), academicSessionId: academic_session_id },
      include: {
        slots: {
          include: {
            subject: { select: { id: true, name: true, code: true } },
            faculty: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!timetable) return sendSuccess(res, null);

    return sendSuccess(res, {
      ...timetable, _id: timetable.id,
      slots: timetable.slots.map((slot) => ({
        ...slot, _id: slot.id,
        subject_id: slot.subject ? { _id: slot.subjectId, name: slot.subject.name, code: slot.subject.code } : slot.subjectId,
        faculty_id: slot.faculty ? { _id: slot.facultyId, name: slot.faculty.name, email: slot.faculty.email } : slot.facultyId,
        time_slot: slot.timeSlot, is_lab: slot.isLab,
      })),
    });
  } catch (err) { return sendError(res, err.message); }
};

exports.upsertTimetable = async (req, res) => {
  try {
    const { branch_id, year, section, academic_session_id, semester, slots } = req.body;

    const conflicts = [];
    const slotMap = {};
    for (const slot of slots) {
      const key = `${slot.day}-${slot.time_slot}`;
      if (slotMap[key]) {
        if (slot.faculty_id && slotMap[key].faculty_id === slot.faculty_id) conflicts.push(`Faculty conflict on ${slot.day} ${slot.time_slot}`);
        if (slot.room && slotMap[key].room === slot.room) conflicts.push(`Room conflict on ${slot.day} ${slot.time_slot}: ${slot.room}`);
      } else { slotMap[key] = slot; }
    }
    if (conflicts.length) return sendBadRequest(res, `Timetable conflicts: ${conflicts.join('; ')}`);

    const existing = await prisma.timetable.findFirst({
      where: { branchId: branch_id, year, section: section || null, academicSessionId: academic_session_id, semester },
    });

    let timetable;
    if (existing) {
      await prisma.timetableSlot.deleteMany({ where: { timetableId: existing.id } });
      timetable = await prisma.timetable.update({
        where: { id: existing.id },
        data: {
          createdById: req.user.id,
          slots: {
            create: slots.map((s) => ({
              day: s.day, timeSlot: s.time_slot, subjectId: s.subject_id,
              facultyId: s.faculty_id, room: s.room || null, isLab: s.is_lab || false,
            })),
          },
        },
        include: { slots: true },
      });
    } else {
      timetable = await prisma.timetable.create({
        data: {
          collegeId: req.user.collegeId, branchId: branch_id, academicSessionId: academic_session_id,
          year, section: section || null, semester, createdById: req.user.id,
          slots: {
            create: slots.map((s) => ({
              day: s.day, timeSlot: s.time_slot, subjectId: s.subject_id,
              facultyId: s.faculty_id, room: s.room || null, isLab: s.is_lab || false,
            })),
          },
        },
        include: { slots: true },
      });
    }

    return sendSuccess(res, { ...timetable, _id: timetable.id }, 'Timetable saved.');
  } catch (err) { return sendError(res, err.message); }
};

exports.publishTimetable = async (req, res) => {
  try {
    const timetable = await prisma.timetable.findUnique({ where: { id: req.params.id } });
    if (!timetable) return sendNotFound(res);
    await prisma.timetable.update({ where: { id: req.params.id }, data: { status: 'published', publishedAt: new Date() } });
    return sendSuccess(res, null, 'Timetable published.');
  } catch (err) { return sendError(res, err.message); }
};

exports.getDeptFaculty = async (req, res) => {
  try {
    const faculty = await prisma.user.findMany({
      where: { departmentId: req.user.departmentId, role: { in: ['faculty', 'coordinator'] }, status: 'active' },
      select: { id: true, name: true, email: true, role: true },
    });

    // Manual join for coordinator branches (no @relation in schema)
    const coordinatorIds = faculty.filter((f) => f.role === 'coordinator').map((f) => f.id);
    const coordBranches = coordinatorIds.length
      ? await prisma.coordinatorBranch.findMany({
          where: { userId: { in: coordinatorIds } },
          select: { userId: true, branchId: true, year: true },
        })
      : [];

    // Fetch branch names
    const branchIds = [...new Set(coordBranches.map((cb) => cb.branchId))];
    const branches = branchIds.length
      ? await prisma.branch.findMany({ where: { id: { in: branchIds } }, select: { id: true, name: true, code: true } })
      : [];
    const branchMap = Object.fromEntries(branches.map((b) => [b.id, b]));

    // Group by userId
    const cbByUser = {};
    coordBranches.forEach((cb) => {
      if (!cbByUser[cb.userId]) cbByUser[cb.userId] = [];
      const b = branchMap[cb.branchId];
      cbByUser[cb.userId].push({ branch_id: b ? { _id: cb.branchId, name: b.name, code: b.code } : cb.branchId, year: cb.year });
    });

    return sendSuccess(res, faculty.map((u) => ({
      ...mapUser(u),
      coordinator_branches: cbByUser[u.id] || [],
    })));
  } catch (err) { return sendError(res, err.message); }
};

exports.getDeptBranches = async (req, res) => {
  try {
    const branches = await prisma.branch.findMany({
      where: { departmentId: req.user.departmentId },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
    return sendSuccess(res, branches.map((b) => ({ _id: b.id, ...b })));
  } catch (err) { return sendError(res, err.message); }
};

exports.getDeptSubjects = async (req, res) => {
  try {
    const deptBranches = await prisma.branch.findMany({
      where: { departmentId: req.user.departmentId },
      select: { id: true },
    });
    const branchIds = deptBranches.map((b) => b.id);

    const where = { branchId: { in: branchIds } };
    if (req.query.branch_id) where.branchId = req.query.branch_id;
    if (req.query.year) where.year = Number(req.query.year);
    if (req.query.semester) where.semester = Number(req.query.semester);


    const subjects = await prisma.subject.findMany({
      where,
      include: { branch: { select: { id: true, name: true, code: true } } },
      orderBy: { name: 'asc' },
    });
    
    // Manual faculty join (assignedFacultyId has no @relation)
    const facultyIds = [...new Set(subjects.map((s) => s.assignedFacultyId).filter(Boolean))];
    const facultyList = facultyIds.length
      ? await prisma.user.findMany({ where: { id: { in: facultyIds } }, select: { id: true, name: true, email: true } })
      : [];
    const facultyMap = Object.fromEntries(facultyList.map((f) => [f.id, f]));
    
    return sendSuccess(res, subjects.map((s) => {
      const f = s.assignedFacultyId ? facultyMap[s.assignedFacultyId] : null;
      return {
        _id: s.id, id: s.id, name: s.name, code: s.code, year: s.year, semester: s.semester, type: s.type, credits: s.credits,
        branch_id: s.branch ? { _id: s.branchId, name: s.branch.name, code: s.branch.code } : s.branchId,
        assigned_faculty: f ? { _id: s.assignedFacultyId, name: f.name, email: f.email } : null,
      };
    }));

  } catch (err) { return sendError(res, err.message); }
};

exports.assignCoordinator = async (req, res) => {
  try {
    const { faculty_id, coordinator_branches } = req.body;
    if (!faculty_id || !coordinator_branches?.length) {
      return sendBadRequest(res, 'faculty_id and coordinator_branches are required.');
    }

    // Keep role as 'faculty' — coordinator status is tracked via CoordinatorBranch table
    // Only update role to coordinator if they are currently faculty
    const user = await prisma.user.findFirst({ where: { id: faculty_id } });
    if (!user) return sendNotFound(res, 'Faculty not found.');

    await prisma.coordinatorBranch.deleteMany({ where: { userId: faculty_id } });
    await prisma.coordinatorBranch.createMany({
      data: coordinator_branches.map((cb) => ({
        collegeId: req.user.collegeId,
        userId: faculty_id,
        branchId: cb.branch_id,
        year: Number(cb.year),
      })),
    });

    return sendSuccess(res, null, 'Coordinator assigned.');
  } catch (err) { return sendError(res, err.message); }
};

exports.lockMarksComponent = async (req, res) => {
  try {
    const { subject_id, branch_id, year, exam_component_id } = req.body;
    await lockComponent(subject_id, branch_id, Number(year), exam_component_id);
    return sendSuccess(res, null, 'Component locked.');
  } catch (err) { return sendError(res, err.message); }
};

exports.unlockMarksComponent = async (req, res) => {
  try {
    const { subject_id, branch_id, year, exam_component_id } = req.body;
    await unlockComponent(subject_id, branch_id, Number(year), exam_component_id);
    return sendSuccess(res, null, 'Component unlocked.');
  } catch (err) { return sendError(res, err.message); }
};

exports.getDeptStudents = async (req, res) => {
  try {
    const hodDeptId = req.user.departmentId;
    const hodCollegeId = req.user.collegeId;

    const deptBranches = await prisma.branch.findMany({
      where: { departmentId: hodDeptId, collegeId: hodCollegeId },
      select: { id: true, name: true, code: true },
    });
    const branchIds = deptBranches.map((b) => b.id);

    // Get ALL students in this college to compare
    const allStudents = await prisma.user.findMany({
      where: { collegeId: hodCollegeId, role: 'student', status: { not: 'deleted' } },
      select: { id: true, name: true, branchId: true, departmentId: true },
    });

    const students = await prisma.user.findMany({
      where: { branchId: { in: branchIds }, role: 'student', status: { not: 'deleted' } },
      orderBy: { name: 'asc' },
    });

    // Return debug info + students
    console.log('HOD DEBUG:', {
      hodDeptId,
      hodCollegeId,
      deptBranches,
      branchIds,
      allStudentBranchIds: allStudents.map(s => ({ name: s.name, branchId: s.branchId, deptId: s.departmentId })),
      matchedStudents: students.length,
    });

    const uniqueBranchIds = [...new Set(students.map((s) => s.branchId).filter(Boolean))];
    const branches = uniqueBranchIds.length
      ? await prisma.branch.findMany({ where: { id: { in: uniqueBranchIds } }, select: { id: true, name: true, code: true } })
      : [];
    const branchMap = Object.fromEntries(branches.map((b) => [b.id, b]));
    
    return sendSuccess(res, students.map((s) => {
      const b = s.branchId ? branchMap[s.branchId] : null;
      return {
        ...mapUser(s),
        branch_id: b ? { _id: s.branchId, name: b.name, code: b.code } : s.branchId,
      };
    }));
  } catch (err) { return sendError(res, err.message); }
};

exports.getStudentAttendance = async (req, res) => {
  try {
    const { student_id } = req.params;
    const [subject, overall] = await Promise.all([
      getStudentSubjectAttendance(student_id),
      getStudentOverallAttendance(student_id),
    ]);
    return sendSuccess(res, { subject_wise: subject, overall });
  } catch (err) { return sendError(res, err.message); }
};

exports.getBranchDefaulters = async (req, res) => {
  try {
    const { branch_id, year, threshold = 75 } = req.query;
    const defaulters = await getBranchDefaulters(branch_id, Number(year), Number(threshold));
    return sendSuccess(res, defaulters);
  } catch (err) { return sendError(res, err.message); }
};

exports.generateParentURL = async (req, res) => {
  try {
    const { student_id, expiry } = req.body;
    if (!student_id) return sendBadRequest(res, 'student_id is required.');
    const token = await generateParentToken(student_id, req.user.id, expiry, req.user.collegeId);
    const url = `${process.env.CLIENT_URL}/parent/${token}`;
    return sendSuccess(res, { url, token }, 'Parent URL generated.');
  } catch (err) { return sendError(res, err.message); }
};

exports.revokeParentURL = async (req, res) => {
  try {
    const { student_id } = req.body;
    await revokeParentToken(student_id);
    return sendSuccess(res, null, 'Parent URL revoked.');
  } catch (err) { return sendError(res, err.message); }
};

exports.postNotice = async (req, res) => {
  try {
    const { title, body, priority, target_type, target_ids, schedule_at, expires_at } = req.body;
    const notice = await prisma.notice.create({
      data: {
        collegeId: req.user.collegeId, title, body, priority: priority || 'normal',
        targetType: target_type, targetIds: Array.isArray(target_ids) ? target_ids.map(String) : [String(target_ids)],
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
    if (!recipient_id || !body) return sendBadRequest(res, 'recipient_id and body are required.');
    const msg = await prisma.message.create({
      data: { collegeId: req.user.collegeId, senderId: req.user.id, recipientId: recipient_id, body },
    });
    return sendCreated(res, { ...msg, _id: msg.id }, 'Message sent.');
  } catch (err) { return sendError(res, err.message); }
};

exports.getMessages = async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: { OR: [{ senderId: req.user.id }, { recipientId: req.user.id }] },
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

exports.assignSubjectFaculty = async (req, res) => {
  try {
    const { subject_id, faculty_id } = req.body;
    if (!subject_id || !faculty_id) return sendBadRequest(res, 'subject_id and faculty_id are required.');

    const deptBranches = await prisma.branch.findMany({ where: { departmentId: req.user.departmentId }, select: { id: true } });
    const branchIds = deptBranches.map((b) => b.id);

    const subject = await prisma.subject.findFirst({ where: { id: subject_id, branchId: { in: branchIds } } });
    if (!subject) return sendNotFound(res, 'Subject not found in your department.');

    const faculty = await prisma.user.findFirst({
      where: { id: faculty_id, departmentId: req.user.departmentId, role: { in: ['faculty', 'coordinator'] } },
    });
    if (!faculty) return sendNotFound(res, 'Faculty not found in your department.');

    await prisma.subject.update({ where: { id: subject_id }, data: { assignedFacultyId: faculty_id } });
    return sendSuccess(res, null, 'Faculty assigned to subject.');
  } catch (err) { return sendError(res, err.message); }
};

exports.getDeptSubjectsWithFaculty = async (req, res) => {
  try {
    const deptBranches = await prisma.branch.findMany({ where: { departmentId: req.user.departmentId }, select: { id: true } });
    const branchIds = deptBranches.map((b) => b.id);

    const where = { branchId: { in: branchIds } };
    if (req.query.branch_id) where.branchId = req.query.branch_id;
    if (req.query.year) where.year = Number(req.query.year);

    const subjects = await prisma.subject.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true, code: true } },
        assignedFaculty: { select: { id: true, name: true, email: true } },
      },
      orderBy: { name: 'asc' },
    });

    return sendSuccess(res, subjects.map((s) => ({
      _id: s.id, id: s.id, name: s.name, code: s.code, year: s.year, semester: s.semester, type: s.type, credits: s.credits,
      branch_id: s.branch ? { _id: s.branchId, name: s.branch.name, code: s.branch.code } : s.branchId,
      assigned_faculty: s.assignedFaculty ? { _id: s.assignedFacultyId, name: s.assignedFaculty.name, email: s.assignedFaculty.email } : null,
    })));
  } catch (err) { return sendError(res, err.message); }
};

exports.createSubject = async (req, res) => {
  try {
    const { name, code, branch_id, year, semester, type, credits } = req.body;
    if (!name || !code || !branch_id || !year || !semester) return sendBadRequest(res, 'Name, code, branch_id, year, and semester are required.');

    const branch = await prisma.branch.findFirst({ where: { id: branch_id, departmentId: req.user.departmentId } });
    if (!branch) return sendBadRequest(res, 'Branch does not belong to your department.');

    const exists = await prisma.subject.findFirst({ where: { collegeId: req.user.collegeId, code: code.toUpperCase() } });
    if (exists) return sendBadRequest(res, 'Subject code already exists.');

    const subject = await prisma.subject.create({
      data: { collegeId: req.user.collegeId, branchId: branch_id, name, code: code.toUpperCase(), year: Number(year), semester: Number(semester), type: type || 'theory', credits: credits || 0 },
    });
    return sendCreated(res, { ...subject, _id: subject.id }, 'Subject created.');
  } catch (err) { return sendError(res, err.message); }
};

exports.updateSubject = async (req, res) => {
  try {
    const deptBranches = await prisma.branch.findMany({ where: { departmentId: req.user.departmentId }, select: { id: true } });
    const branchIds = deptBranches.map((b) => b.id);

    const subject = await prisma.subject.findFirst({ where: { id: req.params.id, branchId: { in: branchIds } } });
    if (!subject) return sendNotFound(res, 'Subject not found in your department.');

    const updated = await prisma.subject.update({
      where: { id: req.params.id },
      data: {
        name: req.body.name, code: req.body.code,
        year: req.body.year ? Number(req.body.year) : undefined,
        semester: req.body.semester ? Number(req.body.semester) : undefined,
        type: req.body.type, credits: req.body.credits,
      },
    });
    return sendSuccess(res, { ...updated, _id: updated.id }, 'Subject updated.');
  } catch (err) { return sendError(res, err.message); }
};

exports.deleteSubject = async (req, res) => {
  try {
    const deptBranches = await prisma.branch.findMany({ where: { departmentId: req.user.departmentId }, select: { id: true } });
    const branchIds = deptBranches.map((b) => b.id);

    const subject = await prisma.subject.findFirst({ where: { id: req.params.id, branchId: { in: branchIds } } });
    if (!subject) return sendNotFound(res, 'Subject not found in your department.');

    await prisma.subject.delete({ where: { id: req.params.id } });
    return sendSuccess(res, null, 'Subject deleted.');
  } catch (err) { return sendError(res, err.message); }
};

exports.markFacultyAttendance = async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) return sendBadRequest(res, 'records array is required.');

    const facultyIds = [...new Set(records.map((r) => r.faculty_id))];
    const validFaculty = await prisma.user.findMany({
      where: { id: { in: facultyIds }, departmentId: req.user.departmentId, role: { in: ['faculty', 'coordinator'] }, status: 'active' },
      select: { id: true },
    });

    const validSet = new Set(validFaculty.map((f) => f.id));
    const invalid = facultyIds.filter((id) => !validSet.has(id));
    if (invalid.length) return sendBadRequest(res, `Faculty not in your department: ${invalid.join(', ')}`);

    await prisma.$transaction(
      records.map(({ faculty_id, date, status, note }) => {
        const day = new Date(new Date(date).toISOString().slice(0, 10));
        return prisma.facultyAttendance.upsert({
          where: { facultyId_date: { facultyId: faculty_id, date: day } },
          update: { status, note: note || null, markedById: req.user.id },
          create: { collegeId: req.user.collegeId, facultyId: faculty_id, departmentId: req.user.departmentId, date: day, status, note: note || null, markedById: req.user.id },
        });
      })
    );

    return sendSuccess(res, null, 'Faculty attendance marked.');
  } catch (err) { return sendError(res, err.message); }
};

exports.getFacultyAttendance = async (req, res) => {
  try {
    const { faculty_id, from, to, month, year } = req.query;
    if (!faculty_id) return sendBadRequest(res, 'faculty_id is required.');

    const faculty = await prisma.user.findFirst({
      where: { id: faculty_id, departmentId: req.user.departmentId, role: { in: ['faculty', 'coordinator'] } },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!faculty) return sendNotFound(res, 'Faculty not found in your department.');

    let dateFilter = {};
    if (from || to) {
      if (from) dateFilter.gte = new Date(from);
      if (to) dateFilter.lte = new Date(to);
    } else if (month && year) {
      const m = Number(month) - 1;
      const y = Number(year);
      dateFilter = { gte: new Date(y, m, 1), lte: new Date(y, m + 1, 0) };
    } else {
      const now = new Date();
      dateFilter = { gte: new Date(now.getFullYear(), now.getMonth(), 1), lte: new Date(now.getFullYear(), now.getMonth() + 1, 0) };
    }

    const records = await prisma.facultyAttendance.findMany({
      where: { facultyId: faculty_id, date: dateFilter },
      orderBy: { date: 'asc' },
    });

    const total = records.length;
    const present = records.filter((r) => r.status === 'present').length;
    const absent = records.filter((r) => r.status === 'absent').length;
    const late = records.filter((r) => r.status === 'late').length;

    return sendSuccess(res, {
      faculty: { ...faculty, _id: faculty.id },
      summary: { total, present, absent, late, percentage: total > 0 ? Math.round((present / total) * 100 * 100) / 100 : 0 },
      records: records.map((r) => ({ ...r, _id: r.id })),
    });
  } catch (err) { return sendError(res, err.message); }
};

exports.getFacultyAttendanceSummary = async (req, res) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
    const day = new Date(dateStr);
    const dayEnd = new Date(dateStr);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const allFaculty = await prisma.user.findMany({
      where: { departmentId: req.user.departmentId, role: { in: ['faculty', 'coordinator'] }, status: 'active' },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    });

    const records = await prisma.facultyAttendance.findMany({
      where: { departmentId: req.user.departmentId, date: { gte: day, lt: dayEnd } },
    });

    const recordMap = {};
    records.forEach((r) => { recordMap[r.facultyId] = r; });

    const summary = allFaculty.map((f) => {
      const rec = recordMap[f.id];
      return { faculty_id: f.id, name: f.name, email: f.email, role: f.role, status: rec?.status || null, note: rec?.note || null, record_id: rec?.id || null };
    });

    return sendSuccess(res, { date: dateStr, summary });
  } catch (err) { return sendError(res, err.message); }
};

exports.getExamPattern = async (req, res) => {
  try {
    const { year, semester } = req.query;
    const department = await prisma.department.findUnique({ where: { id: req.user.departmentId } });
    if (!department) return sendNotFound(res, 'Department not found.');

    const pattern = await prisma.examPattern.findFirst({
      where: { streamId: department.streamId, year: Number(year), semester: Number(semester) },
      include: { components: true },
    });

    if (!pattern) return sendNotFound(res, 'No exam pattern found. Please create one.');

    return sendSuccess(res, {
      ...pattern, _id: pattern.id,
      stream_id: department.streamId,
      components: pattern.components.map((c) => ({
        _id: c.id, id: c.id, name: c.name, max_marks: c.maxMarks, weightage_percent: c.weightagePercent,
        entered_by: c.enteredBy, include_in_sgpa: c.includeInSgpa, pass_marks: c.passMarks,
      })),
    });
  } catch (err) { return sendError(res, err.message); }
};

exports.upsertExamPattern = async (req, res) => {
  try {
    const { year, semester, components, sgpa_formula } = req.body;
    if (!year || !semester || !components?.length) return sendBadRequest(res, 'year, semester, and components are required.');

    const totalWeightage = components.reduce((sum, c) => sum + (c.weightage_percent || 0), 0);
    if (Math.round(totalWeightage) !== 100) return sendBadRequest(res, `Weightages must sum to 100. Current: ${totalWeightage}.`);

    const department = await prisma.department.findUnique({ where: { id: req.user.departmentId } });
    if (!department) return sendNotFound(res, 'Department not found.');

    const existing = await prisma.examPattern.findFirst({
      where: { streamId: department.streamId, year: Number(year), semester: Number(semester) },
    });

    let pattern;
    if (existing) {
      await prisma.examPatternComponent.deleteMany({ where: { examPatternId: existing.id } });
      pattern = await prisma.examPattern.update({
        where: { id: existing.id },
        data: {
          sgpaFormula: sgpa_formula || 'weighted_average',
          components: {
            create: components.map((c) => ({
              name: c.name, maxMarks: c.max_marks, weightagePercent: c.weightage_percent,
              enteredBy: c.entered_by || 'faculty', includeInSgpa: c.include_in_sgpa !== false, passMarks: c.pass_marks || 0,
            })),
          },
        },
        include: { components: true },
      });
    } else {
      pattern = await prisma.examPattern.create({
        data: {
          collegeId: req.user.collegeId, streamId: department.streamId, year: Number(year), semester: Number(semester),
          sgpaFormula: sgpa_formula || 'weighted_average',
          components: {
            create: components.map((c) => ({
              name: c.name, maxMarks: c.max_marks, weightagePercent: c.weightage_percent,
              enteredBy: c.entered_by || 'faculty', includeInSgpa: c.include_in_sgpa !== false, passMarks: c.pass_marks || 0,
            })),
          },
        },
        include: { components: true },
      });
    }

    return sendSuccess(res, { ...pattern, _id: pattern.id }, 'Exam pattern saved.');
  } catch (err) { return sendError(res, err.message); }
};

exports.getMarksEntries = async (req, res) => {
  try {
    const { subject_id, branch_id, year, semester, exam_component_id } = req.query;

    const branch = await prisma.branch.findFirst({ where: { id: branch_id, departmentId: req.user.departmentId } });
    if (!branch) return sendForbidden(res, 'Branch not in your department.');

    const students = await prisma.user.findMany({
      where: { branchId: branch_id, year: Number(year), role: 'student', status: 'active' },
      select: { id: true, name: true, enrollmentNumber: true },
      orderBy: { name: 'asc' },
    });

    const marksList = await prisma.marks.findMany({
      where: { subjectId: subject_id, branchId: branch_id, year: Number(year), semester: Number(semester), examComponentId: exam_component_id },
    });

    const marksMap = {};
    for (const m of marksList) marksMap[m.studentId] = m;

    return sendSuccess(res, {
      students: students.map((s) => ({ _id: s.id, name: s.name, enrollment_number: s.enrollmentNumber, marks: marksMap[s.id] || null })),
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

exports.getQuizMarks = async (req, res) => {
  try {
    const { branch_id, year, subject_id, quiz_id } = req.query;

    const deptBranches = await prisma.branch.findMany({ where: { departmentId: req.user.departmentId }, select: { id: true } });
    const branchIds = deptBranches.map((b) => b.id);

    if (branch_id) {
      const branch = await prisma.branch.findFirst({ where: { id: branch_id, departmentId: req.user.departmentId } });
      if (!branch) return sendForbidden(res, 'Branch not in your department.');
    }

    if (quiz_id) {
      const quiz = await prisma.quiz.findFirst({
        where: { id: quiz_id, branchId: { in: branchIds } },
        include: { subject: { select: { name: true, code: true } } },
      });
      if (!quiz) return sendNotFound(res, 'Quiz not found.');

      const attempts = await prisma.quizAttempt.findMany({
        where: { quizId: quiz_id, submittedAt: { not: null } },
        include: { student: { select: { id: true, name: true, enrollmentNumber: true } } },
        orderBy: { score: 'desc' },
      });

      return sendSuccess(res, {
        quiz: { ...quiz, _id: quiz.id, total_marks: quiz.totalMarks, subject_id: { _id: quiz.subjectId, name: quiz.subject?.name, code: quiz.subject?.code } },
        students: attempts.map((a) => ({
          _id: a.studentId, name: a.student?.name, enrollment_number: a.student?.enrollmentNumber,
          score: a.score ?? 0, total_marks: quiz.totalMarks,
          percentage: quiz.totalMarks > 0 ? Math.round(((a.score ?? 0) / quiz.totalMarks) * 100) : 0,
          submitted_at: a.submittedAt, is_auto_submitted: a.isAutoSubmitted,
        })),
      });
    }

    const quizWhere = { branchId: { in: branchIds }, status: 'published' };
    if (branch_id) quizWhere.branchId = branch_id;
    if (year) quizWhere.year = Number(year);
    if (subject_id) quizWhere.subjectId = subject_id;

    const quizzes = await prisma.quiz.findMany({
      where: quizWhere,
      include: { subject: { select: { name: true, code: true } } },
      orderBy: { startTime: 'desc' },
    });

    const quizIds = quizzes.map((q) => q.id);
    const attemptCounts = await prisma.quizAttempt.groupBy({
      by: ['quizId'],
      where: { quizId: { in: quizIds }, submittedAt: { not: null } },
      _count: { id: true },
      _avg: { score: true },
    });

    const attemptMap = {};
    attemptCounts.forEach((a) => { attemptMap[a.quizId] = { count: a._count.id, avg_score: a._avg.score }; });

    return sendSuccess(res, {
      quizzes: quizzes.map((q) => {
        const a = attemptMap[q.id] || { count: 0, avg_score: null };
        return {
          ...q, _id: q.id, attempt_count: a.count,
          avg_score: a.avg_score !== null ? Math.round(a.avg_score * 10) / 10 : null,
          total_marks: q.totalMarks, start_time: q.startTime, end_time: q.endTime,
          subject_id: q.subject ? { _id: q.subjectId, name: q.subject.name, code: q.subject.code } : q.subjectId,
          branch_id: q.branch ? { _id: q.branchId, name: q.branch.name, code: q.branch.code } : q.branchId,
        };
      }),
    });
  } catch (err) { return sendError(res, err.message); }
};