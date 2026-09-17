const prisma = require('../config/prismaClient');
const {
  sendSuccess,
  sendCreated,
  sendError,
  sendNotFound,
  sendBadRequest,
  sendConflict,
} = require('../utils/apiResponse');
const { ROLES, USER_STATUS } = require('../config/constants');
const { processStudentCSV } = require('../services/csv.service');
const logger = require('../utils/logger');

// ─── MAPPERS ────────────────────────────────────────────────────────────────
// Every Prisma model uses camelCase ids (id, streamId, departmentId...).
// The existing frontend was built against the old Mongoose shape (_id,
// stream_id, department_id, branch_id as populated objects). Rather than
// touch a dozen frontend pages, we shape the API responses below to match
// that original contract exactly.

const mapStream = (s) => ({
  _id: s.id,
  id: s.id,
  name: s.name,
  code: s.code,
  status: s.status,
  created_at: s.createdAt,
  updated_at: s.updatedAt,
});

const mapDepartment = (d, streamOverride) => {
  const stream = streamOverride || d.stream;
  return {
    _id: d.id,
    id: d.id,
    name: d.name,
    code: d.code,
    status: d.status,
    stream_id: stream ? { _id: stream.id, id: stream.id, name: stream.name, code: stream.code } : d.streamId,
    created_at: d.createdAt,
    updated_at: d.updatedAt,
  };
};

const mapBranch = (b, deptOverride) => {
  const department = deptOverride || b.department;
  return {
    _id: b.id,
    id: b.id,
    name: b.name,
    code: b.code,
    status: b.status,
    department_id: department
      ? { _id: department.id, id: department.id, name: department.name, code: department.code }
      : b.departmentId,
    created_at: b.createdAt,
    updated_at: b.updatedAt,
  };
};

const mapSubject = (s, branchOverride) => {
  const branch = branchOverride || s.branch;
  return {
    _id: s.id,
    id: s.id,
    name: s.name,
    code: s.code,
    year: s.year,
    semester: s.semester,
    type: s.type,
    credits: s.credits,
    status: s.status,
    branch_id: branch ? { _id: branch.id, id: branch.id, name: branch.name, code: branch.code } : s.branchId,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  };
};

const mapUser = (u, deptMap = {}, branchMap = {}) => {
  const dept = u.departmentId ? deptMap[u.departmentId] : null;
  const branch = u.branchId ? branchMap[u.branchId] : null;
  return {
    _id: u.id,
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    department_id: dept ? { _id: dept.id, id: dept.id, name: dept.name, code: dept.code } : u.departmentId,
    branch_id: branch ? { _id: branch.id, id: branch.id, name: branch.name, code: branch.code } : u.branchId,
    year: u.year,
    enrollment_number: u.enrollmentNumber,
    section: u.section,
    phone: u.phone,
    semester: u.semester,
    last_login: u.lastLogin,
    created_at: u.createdAt,
    updated_at: u.updatedAt,
  };
};

// Fetch department/branch lookup maps for a list of users in one go
// (Prisma has no FK relation on User.departmentId/branchId, so we join manually).
async function buildLookupMaps(users) {
  const deptIds = [...new Set(users.map((u) => u.departmentId).filter(Boolean))];
  const branchIds = [...new Set(users.map((u) => u.branchId).filter(Boolean))];
  const [depts, branches] = await Promise.all([
    deptIds.length ? prisma.department.findMany({ where: { id: { in: deptIds } } }) : [],
    branchIds.length ? prisma.branch.findMany({ where: { id: { in: branchIds } } }) : [],
  ]);
  return {
    deptMap: Object.fromEntries(depts.map((d) => [d.id, d])),
    branchMap: Object.fromEntries(branches.map((b) => [b.id, b])),
  };
}

// FinalResultConfig currently requires an academicSessionId, but there's no
// UI yet to open one explicitly — auto-provision a "current" session per
// college so this doesn't hard-block superadmins.
async function getOrCreateCurrentSession(collegeId) {
  let session = await prisma.academicSession.findFirst({ where: { collegeId, isCurrent: true } });
  if (session) return session;

  const year = new Date().getFullYear();
  session = await prisma.academicSession.create({
    data: {
      collegeId,
      label: `${year}-${year + 1}`,
      startDate: new Date(`${year}-06-01`),
      endDate: new Date(`${year + 1}-05-31`),
      status: 'active',
      isCurrent: true,
    },
  });
  return session;
}

// ─── STREAMS ────────────────────────────────────────────────────────────────

exports.getStreams = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const streams = await prisma.stream.findMany({ where: { collegeId }, orderBy: { name: 'asc' } });
    return sendSuccess(res, streams.map(mapStream));
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.createStream = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const { name, code } = req.body;
    if (!name || !code) return sendBadRequest(res, 'Name and code are required.');

    const exists = await prisma.stream.findFirst({ where: { collegeId, code: code.toUpperCase() } });
    if (exists) return sendConflict(res, 'Stream code already exists.');

    const stream = await prisma.stream.create({ data: { collegeId, name, code: code.toUpperCase() } });
    return sendCreated(res, mapStream(stream), 'Stream created.');
  } catch (err) {
    if (err.code === 'P2002') return sendConflict(res, 'Stream code already exists.');
    return sendError(res, err.message);
  }
};

exports.updateStream = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const existing = await prisma.stream.findFirst({ where: { id: req.params.id, collegeId } });
    if (!existing) return sendNotFound(res, 'Stream not found.');

    const { name, code } = req.body;
    const stream = await prisma.stream.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(code !== undefined ? { code: code.toUpperCase() } : {}),
      },
    });
    return sendSuccess(res, mapStream(stream), 'Stream updated.');
  } catch (err) {
    if (err.code === 'P2002') return sendConflict(res, 'Stream code already exists.');
    return sendError(res, err.message);
  }
};

exports.deleteStream = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const existing = await prisma.stream.findFirst({ where: { id: req.params.id, collegeId } });
    if (!existing) return sendNotFound(res, 'Stream not found.');

    const deptIds = (await prisma.department.findMany({
      where: { streamId: req.params.id },
      select: { id: true },
    })).map((d) => d.id);

    const hasBranches = deptIds.length
      ? await prisma.branch.count({ where: { departmentId: { in: deptIds } } })
      : 0;
    if (hasBranches) return sendBadRequest(res, 'Cannot delete: branches exist under this stream.');

    await prisma.stream.delete({ where: { id: req.params.id } });
    return sendSuccess(res, null, 'Stream deleted.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── DEPARTMENTS ─────────────────────────────────────────────────────────────

exports.getDepartments = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const where = { collegeId };
    if (req.query.stream_id) where.streamId = req.query.stream_id;

    const departments = await prisma.department.findMany({
      where,
      include: { stream: true },
      orderBy: { name: 'asc' },
    });
    return sendSuccess(res, departments.map((d) => mapDepartment(d)));
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.createDepartment = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const { name, code, stream_id } = req.body;
    if (!name || !code || !stream_id) return sendBadRequest(res, 'Name, code, and stream_id are required.');

    const stream = await prisma.stream.findFirst({ where: { id: stream_id, collegeId } });
    if (!stream) return sendBadRequest(res, 'Invalid stream_id.');

    const exists = await prisma.department.findFirst({ where: { collegeId, code: code.toUpperCase() } });
    if (exists) return sendConflict(res, 'Department code already exists.');

    const dept = await prisma.department.create({
      data: { collegeId, name, code: code.toUpperCase(), streamId: stream_id },
    });
    return sendCreated(res, mapDepartment(dept, stream), 'Department created.');
  } catch (err) {
    if (err.code === 'P2002') return sendConflict(res, 'Department code already exists.');
    return sendError(res, err.message);
  }
};

exports.updateDepartment = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const existing = await prisma.department.findFirst({ where: { id: req.params.id, collegeId } });
    if (!existing) return sendNotFound(res, 'Department not found.');

    const { name, code, stream_id } = req.body;
    if (stream_id) {
      const stream = await prisma.stream.findFirst({ where: { id: stream_id, collegeId } });
      if (!stream) return sendBadRequest(res, 'Invalid stream_id.');
    }

    const dept = await prisma.department.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(code !== undefined ? { code: code.toUpperCase() } : {}),
        ...(stream_id !== undefined ? { streamId: stream_id } : {}),
      },
      include: { stream: true },
    });
    return sendSuccess(res, mapDepartment(dept), 'Department updated.');
  } catch (err) {
    if (err.code === 'P2002') return sendConflict(res, 'Department code already exists.');
    return sendError(res, err.message);
  }
};

exports.deleteDepartment = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const existing = await prisma.department.findFirst({ where: { id: req.params.id, collegeId } });
    if (!existing) return sendNotFound(res, 'Department not found.');

    const hasUsers = await prisma.user.count({ where: { collegeId, departmentId: req.params.id } });
    if (hasUsers) return sendBadRequest(res, 'Cannot delete: users assigned to this department.');

    await prisma.department.delete({ where: { id: req.params.id } });
    return sendSuccess(res, null, 'Department deleted.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── BRANCHES ────────────────────────────────────────────────────────────────

exports.getBranches = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const where = { collegeId };
    if (req.query.department_id) where.departmentId = req.query.department_id;

    const branches = await prisma.branch.findMany({
      where,
      include: { department: true },
      orderBy: { name: 'asc' },
    });
    return sendSuccess(res, branches.map((b) => mapBranch(b)));
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.createBranch = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const { name, code, department_id } = req.body;
    if (!name || !code || !department_id) return sendBadRequest(res, 'Name, code, and department_id are required.');

    const department = await prisma.department.findFirst({ where: { id: department_id, collegeId } });
    if (!department) return sendBadRequest(res, 'Invalid department_id.');

    const exists = await prisma.branch.findFirst({ where: { collegeId, code: code.toUpperCase() } });
    if (exists) return sendConflict(res, 'Branch code already exists.');

    const branch = await prisma.branch.create({
      data: { collegeId, name, code: code.toUpperCase(), departmentId: department_id },
    });
    return sendCreated(res, mapBranch(branch, department), 'Branch created.');
  } catch (err) {
    if (err.code === 'P2002') return sendConflict(res, 'Branch code already exists.');
    return sendError(res, err.message);
  }
};

exports.updateBranch = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const existing = await prisma.branch.findFirst({ where: { id: req.params.id, collegeId } });
    if (!existing) return sendNotFound(res, 'Branch not found.');

    const { name, code, department_id } = req.body;
    if (department_id) {
      const department = await prisma.department.findFirst({ where: { id: department_id, collegeId } });
      if (!department) return sendBadRequest(res, 'Invalid department_id.');
    }

    const branch = await prisma.branch.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(code !== undefined ? { code: code.toUpperCase() } : {}),
        ...(department_id !== undefined ? { departmentId: department_id } : {}),
      },
      include: { department: true },
    });
    return sendSuccess(res, mapBranch(branch), 'Branch updated.');
  } catch (err) {
    if (err.code === 'P2002') return sendConflict(res, 'Branch code already exists.');
    return sendError(res, err.message);
  }
};

exports.deleteBranch = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const existing = await prisma.branch.findFirst({ where: { id: req.params.id, collegeId } });
    if (!existing) return sendNotFound(res, 'Branch not found.');

    const hasStudents = await prisma.user.count({
      where: { collegeId, branchId: req.params.id, role: ROLES.STUDENT },
    });
    if (hasStudents) return sendBadRequest(res, 'Cannot delete: students assigned to this branch.');

    await prisma.branch.delete({ where: { id: req.params.id } });
    return sendSuccess(res, null, 'Branch deleted.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── SUBJECTS ────────────────────────────────────────────────────────────────

exports.getSubjects = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const where = { collegeId };
    if (req.query.branch_id) where.branchId = req.query.branch_id;
    if (req.query.year) where.year = Number(req.query.year);
    if (req.query.semester) where.semester = Number(req.query.semester);

    const subjects = await prisma.subject.findMany({
      where,
      include: { branch: true },
      orderBy: { name: 'asc' },
    });
    return sendSuccess(res, subjects.map((s) => mapSubject(s)));
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.createSubject = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const { name, code, branch_id, year, semester, type, credits } = req.body;
    if (!name || !code || !branch_id || !year || !semester) {
      return sendBadRequest(res, 'Name, code, branch_id, year, and semester are required.');
    }

    const branch = await prisma.branch.findFirst({ where: { id: branch_id, collegeId } });
    if (!branch) return sendBadRequest(res, 'Invalid branch_id.');

    const exists = await prisma.subject.findFirst({ where: { collegeId, code: code.toUpperCase() } });
    if (exists) return sendConflict(res, 'Subject code already exists.');

    const subject = await prisma.subject.create({
      data: {
        collegeId,
        name,
        code: code.toUpperCase(),
        branchId: branch_id,
        year: Number(year),
        semester: Number(semester),
        type: type || 'theory',
        credits: credits ?? 0,
      },
    });
    return sendCreated(res, mapSubject(subject, branch), 'Subject created.');
  } catch (err) {
    if (err.code === 'P2002') return sendConflict(res, 'Subject code already exists.');
    return sendError(res, err.message);
  }
};

exports.updateSubject = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const existing = await prisma.subject.findFirst({ where: { id: req.params.id, collegeId } });
    if (!existing) return sendNotFound(res, 'Subject not found.');

    const { name, code, branch_id, year, semester, type, credits } = req.body;
    if (branch_id) {
      const branch = await prisma.branch.findFirst({ where: { id: branch_id, collegeId } });
      if (!branch) return sendBadRequest(res, 'Invalid branch_id.');
    }

    const subject = await prisma.subject.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(code !== undefined ? { code: code.toUpperCase() } : {}),
        ...(branch_id !== undefined ? { branchId: branch_id } : {}),
        ...(year !== undefined ? { year: Number(year) } : {}),
        ...(semester !== undefined ? { semester: Number(semester) } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(credits !== undefined ? { credits } : {}),
      },
      include: { branch: true },
    });
    return sendSuccess(res, mapSubject(subject), 'Subject updated.');
  } catch (err) {
    if (err.code === 'P2002') return sendConflict(res, 'Subject code already exists.');
    return sendError(res, err.message);
  }
};

exports.deleteSubject = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const existing = await prisma.subject.findFirst({ where: { id: req.params.id, collegeId } });
    if (!existing) return sendNotFound(res, 'Subject not found.');

    await prisma.subject.delete({ where: { id: req.params.id } });
    return sendSuccess(res, null, 'Subject deleted.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── USERS (faculty / hod / examcontroller / student / coordinator) ─────────

exports.getUsers = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const { role, department_id, status } = req.query;
    const where = { collegeId };
    if (role) where.role = role;
    if (department_id) where.departmentId = department_id;
    if (status) where.status = status;

    const users = await prisma.user.findMany({ where, orderBy: { name: 'asc' } });
    const { deptMap, branchMap } = await buildLookupMaps(users);

    return sendSuccess(res, users.map((u) => mapUser(u, deptMap, branchMap)));
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.createUser = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const { name, email, role, department_id, branch_id, phone, year, enrollment_number, semester, section } = req.body;

    if (!name || !email || !role) return sendBadRequest(res, 'Name, email, and role are required.');

    if (role === ROLES.SUPERADMIN) return sendBadRequest(res, 'Cannot create superadmin via API.');

    const exists = await prisma.user.findFirst({ where: { collegeId, email: email.toLowerCase() } });
    if (exists) return sendConflict(res, 'Email already registered.');

    const user = await prisma.user.create({
      data: {
        collegeId,
        name,
        email: email.toLowerCase(),
        role,
        departmentId: department_id || null,
        branchId: branch_id || null,
        phone: phone || null,
        status: USER_STATUS.ACTIVE,
        ...(year ? { year: Number(year) } : {}),
        ...(semester ? { semester: Number(semester) } : {}),
        ...(enrollment_number ? { enrollmentNumber: enrollment_number } : {}),
        ...(section ? { section } : {}),
      },
    });
    const { deptMap, branchMap } = await buildLookupMaps([user]);
    return sendCreated(res, mapUser(user, deptMap, branchMap), 'User created.');
  } catch (err) {
    if (err.code === 'P2002') return sendConflict(res, 'Email already registered.');
    logger.error(`CREATE USER ERROR: ${err.message}`);
    return sendError(res, err.message);
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const existing = await prisma.user.findFirst({ where: { id: req.params.id, collegeId } });
    if (!existing) return sendNotFound(res, 'User not found.');

    const { role, name, email, department_id, branch_id, phone, ...rest } = req.body;
    // Prevent role escalation to superadmin
    if (role === ROLES.SUPERADMIN) return sendBadRequest(res, 'Invalid role.');

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(role !== undefined ? { role } : {}),
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email: email.toLowerCase() } : {}),
        ...(department_id !== undefined ? { departmentId: department_id || null } : {}),
        ...(branch_id !== undefined ? { branchId: branch_id || null } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(rest.year !== undefined ? { year: rest.year !== '' && rest.year !== null ? Number(rest.year) : null } : {}),
        ...(rest.semester !== undefined ? { semester: rest.semester !== '' && rest.semester !== null ? Number(rest.semester) : null } : {}),
        ...(rest.section !== undefined ? { section: rest.section || null } : {}),
        ...(rest.enrollment_number !== undefined ? { enrollmentNumber: rest.enrollment_number || null } : {}),
      },
    });
    const { deptMap, branchMap } = await buildLookupMaps([user]);
    return sendSuccess(res, mapUser(user, deptMap, branchMap), 'User updated.');
  } catch (err) {
    if (err.code === 'P2002') return sendConflict(res, 'Email already registered.');
    return sendError(res, err.message);
  }
};

exports.deactivateUser = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const existing = await prisma.user.findFirst({ where: { id: req.params.id, collegeId } });
    if (!existing) return sendNotFound(res, 'User not found.');

    await prisma.user.update({ where: { id: req.params.id }, data: { status: USER_STATUS.INACTIVE } });
    return sendSuccess(res, null, 'User deactivated.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const user = await prisma.user.findFirst({ where: { id: req.params.id, collegeId } });
    if (!user) return sendNotFound(res, 'User not found.');

    // Students: soft delete
    if (user.role === ROLES.STUDENT) {
      await prisma.user.update({ where: { id: req.params.id }, data: { status: USER_STATUS.DELETED } });
      return sendSuccess(res, null, 'Student soft-deleted. Data retained.');
    }

    // Faculty: block if active (published) quiz exists
    if (user.role === ROLES.FACULTY) {
      const activeQuiz = await prisma.quiz.count({
        where: { collegeId, createdById: req.params.id, status: 'published' },
      });
      if (activeQuiz) return sendBadRequest(res, 'Cannot delete: faculty has active published quiz.');
    }

    await prisma.user.delete({ where: { id: req.params.id } });
    return sendSuccess(res, null, 'User deleted.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── STUDENT CSV UPLOAD ──────────────────────────────────────────────────────

exports.uploadStudentsCSV = async (req, res) => {
  try {
    if (!req.file) return sendBadRequest(res, 'CSV file is required.');
    const { collegeId } = req.user;
    const result = await processStudentCSV(req.file.buffer, collegeId);
    return sendSuccess(res, result, `Import complete. ${result.imported} students added.`);
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.downloadStudentCSVTemplate = async (_req, res) => {
  try {
    const { generateStudentCSVTemplate } = require('../utils/csvTemplateGenerator');
    const buffer = generateStudentCSVTemplate();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="student_upload_template.csv"');
    return res.send(buffer);
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── EXAM PATTERN ────────────────────────────────────────────────────────────

const mapExamPattern = (p) => ({
  _id: p.id,
  id: p.id,
  stream_id: p.streamId,
  year: p.year,
  semester: p.semester,
  locked: p.locked,
  force_unlock_by: p.forceUnlockBy,
  sgpa_formula: p.sgpaFormula,
  components: (p.components || []).map((c) => ({
    _id: c.id,
    id: c.id,
    name: c.name,
    max_marks: c.maxMarks,
    weightage_percent: c.weightagePercent,
    entered_by: c.enteredBy,
    include_in_sgpa: c.includeInSgpa,
    pass_marks: c.passMarks,
  })),
});

exports.getExamPattern = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const { stream_id, year, semester } = req.query;
    const pattern = await prisma.examPattern.findFirst({
      where: { collegeId, streamId: stream_id, year: Number(year), semester: Number(semester) },
      include: { components: true },
    });
    if (!pattern) return sendNotFound(res, 'Exam pattern not configured for this stream/year/semester.');
    return sendSuccess(res, mapExamPattern(pattern));
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.upsertExamPattern = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const { stream_id, year, semester, components, sgpa_formula } = req.body;
    if (!stream_id || !year || !semester || !components?.length) {
      return sendBadRequest(res, 'stream_id, year, semester, and components are required.');
    }

    const totalWeightage = components.reduce((sum, c) => sum + (c.weightage_percent || 0), 0);
    if (Math.round(totalWeightage) !== 100) {
      return sendBadRequest(res, `Component weightages must sum to 100. Current sum: ${totalWeightage}.`);
    }

    const pattern = await prisma.$transaction(async (tx) => {
      const existing = await tx.examPattern.findFirst({
        where: { collegeId, streamId: stream_id, year: Number(year), semester: Number(semester) },
      });

      const p = existing
        ? await tx.examPattern.update({
          where: { id: existing.id },
          data: { sgpaFormula: sgpa_formula || 'weighted_average' },
        })
        : await tx.examPattern.create({
          data: {
            collegeId,
            streamId: stream_id,
            year: Number(year),
            semester: Number(semester),
            sgpaFormula: sgpa_formula || 'weighted_average',
          },
        });

      await tx.examPatternComponent.deleteMany({ where: { examPatternId: p.id } });
      await tx.examPatternComponent.createMany({
        data: components.map((c) => ({
          examPatternId: p.id,
          name: c.name,
          maxMarks: c.max_marks,
          weightagePercent: c.weightage_percent,
          enteredBy: c.entered_by,
          includeInSgpa: c.include_in_sgpa ?? true,
          passMarks: c.pass_marks ?? 0,
        })),
      });

      return tx.examPattern.findUnique({ where: { id: p.id }, include: { components: true } });
    });

    return sendSuccess(res, mapExamPattern(pattern), 'Exam pattern saved.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.forceUnlockExamPattern = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const existing = await prisma.examPattern.findFirst({ where: { id: req.params.id, collegeId } });
    if (!existing) return sendNotFound(res);

    await prisma.examPattern.update({
      where: { id: req.params.id },
      data: { locked: false, forceUnlockBy: req.user.id },
    });
    return sendSuccess(res, null, 'Exam pattern force-unlocked. SGPA will recalculate.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── AUDIT LOGS ──────────────────────────────────────────────────────────────

const mapAuditLog = (l) => ({
  _id: l.id,
  id: l.id,
  actor_id: l.actorId,
  actor_role: l.actorRole,
  actor_name: l.actorName,
  action: l.action,
  resource_type: l.resourceType,
  resource_id: l.resourceId,
  ip_address: l.ipAddress,
  metadata: l.metadata,
  created_at: l.createdAt,
});

exports.getAuditLogs = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const { actor_id, action, resource_type, from, to, page = 1, limit = 50 } = req.query;
    const where = { collegeId };
    if (actor_id) where.actorId = actor_id;
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (resource_type) where.resourceType = resource_type;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: Number(limit) }),
      prisma.auditLog.count({ where }),
    ]);

    return sendSuccess(res, {
      logs: logs.map(mapAuditLog),
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.exportAuditLogsCSV = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const { from, to } = req.query;
    const where = { collegeId };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const logs = await prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' } });
    const { Parser } = require('json2csv');
    const fields = ['actor_name', 'actor_role', 'action', 'resource_type', 'ip_address', 'created_at'];
    const parser = new Parser({ fields });
    const csv = parser.parse(logs.map(mapAuditLog));

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit_logs.csv"');
    return res.send(csv);
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── NOTICES ─────────────────────────────────────────────────────────────────

const mapNotice = (n, posterMap = {}) => {
  const poster = n.postedById ? posterMap[n.postedById] : null;
  return {
    _id: n.id,
    id: n.id,
    title: n.title,
    body: n.body,
    priority: n.priority,
    posted_by: poster ? { _id: poster.id, id: poster.id, name: poster.name, role: poster.role } : n.postedById,
    target_type: n.targetType,
    target_ids: n.targetIds,
    schedule_at: n.scheduleAt,
    expires_at: n.expiresAt,
    created_at: n.createdAt,
    updated_at: n.updatedAt,
  };
};

exports.getNotices = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const where = { collegeId };
    if (req.query.priority) where.priority = req.query.priority;

    const notices = await prisma.notice.findMany({ where, orderBy: { createdAt: 'desc' } });
    const posterIds = [...new Set(notices.map((n) => n.postedById).filter(Boolean))];
    const posters = posterIds.length ? await prisma.user.findMany({ where: { id: { in: posterIds } } }) : [];
    const posterMap = Object.fromEntries(posters.map((p) => [p.id, p]));

    return sendSuccess(res, notices.map((n) => mapNotice(n, posterMap)));
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.createNotice = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const { title, body, priority, target_type, target_ids, schedule_at, expires_at } = req.body;
    if (!title || !body || !target_type) {
      return sendBadRequest(res, 'Title, body, and target_type are required.');
    }

    const notice = await prisma.notice.create({
      data: {
        collegeId,
        title,
        body,
        priority: priority || 'normal',
        targetType: target_type,
        targetIds: target_ids || [],
        scheduleAt: schedule_at || null,
        expiresAt: expires_at || null,
        postedById: req.user.id,
      },
    });
    return sendCreated(res, mapNotice(notice, { [req.user.id]: req.user }), 'Notice posted.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.updateNotice = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const existing = await prisma.notice.findFirst({ where: { id: req.params.id, collegeId } });
    if (!existing) return sendNotFound(res, 'Notice not found.');

    const { title, body, priority, target_type, target_ids, schedule_at, expires_at } = req.body;
    const notice = await prisma.notice.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(body !== undefined ? { body } : {}),
        ...(priority !== undefined ? { priority } : {}),
        ...(target_type !== undefined ? { targetType: target_type } : {}),
        ...(target_ids !== undefined ? { targetIds: target_ids } : {}),
        ...(schedule_at !== undefined ? { scheduleAt: schedule_at || null } : {}),
        ...(expires_at !== undefined ? { expiresAt: expires_at || null } : {}),
      },
    });
    return sendSuccess(res, mapNotice(notice), 'Notice updated.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.deleteNotice = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const existing = await prisma.notice.findFirst({ where: { id: req.params.id, collegeId } });
    if (!existing) return sendNotFound(res, 'Notice not found.');

    await prisma.notice.delete({ where: { id: req.params.id } });
    return sendSuccess(res, null, 'Notice deleted.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── FINAL RESULT CONFIG (SuperAdmin) ────────────────────────────────────────

const mapFinalResultConfig = (c) => ({
  _id: c.id,
  id: c.id,
  label: c.label,
  metric_type: c.metricType,
  year: c.year,
  semester: c.semester,
  max_value: c.maxValue,
  passing_value: c.passingValue,
  decimal_places: c.decimalPlaces,
  is_active: c.isActive,
  created_at: c.createdAt,
});

exports.getFinalResultConfigs = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const where = { collegeId };
    if (req.query.year) where.year = Number(req.query.year);
    if (req.query.semester) where.semester = Number(req.query.semester);

    const configs = await prisma.finalResultConfig.findMany({
      where,
      orderBy: [{ year: 'asc' }, { semester: 'asc' }, { createdAt: 'desc' }],
    });
    return sendSuccess(res, configs.map(mapFinalResultConfig));
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.createFinalResultConfig = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const { label, metric_type, year, semester, max_value, passing_value, decimal_places } = req.body;
    if (!label || !metric_type || !year || !semester || max_value == null || passing_value == null) {
      return sendBadRequest(res, 'label, metric_type, year, semester, max_value, passing_value are required.');
    }

    const session = await getOrCreateCurrentSession(collegeId);

    const config = await prisma.finalResultConfig.create({
      data: {
        collegeId,
        academicSessionId: session.id,
        label,
        metricType: metric_type,
        year: Number(year),
        semester: Number(semester),
        maxValue: max_value,
        passingValue: passing_value,
        decimalPlaces: decimal_places ?? 2,
        createdById: req.user.id,
      },
    });
    return sendCreated(res, mapFinalResultConfig(config), 'Final result config created.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.updateFinalResultConfig = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const existing = await prisma.finalResultConfig.findFirst({ where: { id: req.params.id, collegeId } });
    if (!existing) return sendNotFound(res, 'Config not found.');

    const { label, metric_type, year, semester, max_value, passing_value, decimal_places, is_active } = req.body;
    const config = await prisma.finalResultConfig.update({
      where: { id: req.params.id },
      data: {
        ...(label !== undefined ? { label } : {}),
        ...(metric_type !== undefined ? { metricType: metric_type } : {}),
        ...(year !== undefined ? { year: Number(year) } : {}),
        ...(semester !== undefined ? { semester: Number(semester) } : {}),
        ...(max_value !== undefined ? { maxValue: max_value } : {}),
        ...(passing_value !== undefined ? { passingValue: passing_value } : {}),
        ...(decimal_places !== undefined ? { decimalPlaces: decimal_places } : {}),
        ...(is_active !== undefined ? { isActive: is_active } : {}),
      },
    });
    return sendSuccess(res, mapFinalResultConfig(config), 'Config updated.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.deleteFinalResultConfig = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const existing = await prisma.finalResultConfig.findFirst({ where: { id: req.params.id, collegeId } });
    if (!existing) return sendNotFound(res, 'Config not found.');

    const hasResults = await prisma.finalResult.count({ where: { configId: req.params.id } });
    if (hasResults) return sendBadRequest(res, 'Cannot delete: results already submitted for this config.');

    await prisma.finalResultConfig.delete({ where: { id: req.params.id } });
    return sendSuccess(res, null, 'Config deleted.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.getFinalResultsAdmin = async (req, res) => {
  try {
    const { collegeId } = req.user;
    const { config_id, branch_id, department_id } = req.query;
    if (!config_id) return sendBadRequest(res, 'config_id is required.');

    const where = { collegeId, configId: config_id };
    if (branch_id) where.branchId = branch_id;
    if (department_id) where.departmentId = department_id;

    const results = await prisma.finalResult.findMany({ where, orderBy: { value: 'desc' } });

    const studentIds = [...new Set(results.map((r) => r.studentId))];
    const branchIds = [...new Set(results.map((r) => r.branchId))];
    const deptIds = [...new Set(results.map((r) => r.departmentId))];
    const [students, branches, departments] = await Promise.all([
      studentIds.length ? prisma.user.findMany({ where: { id: { in: studentIds } } }) : [],
      branchIds.length ? prisma.branch.findMany({ where: { id: { in: branchIds } } }) : [],
      deptIds.length ? prisma.department.findMany({ where: { id: { in: deptIds } } }) : [],
    ]);
    const studentMap = Object.fromEntries(students.map((s) => [s.id, s]));
    const branchMap = Object.fromEntries(branches.map((b) => [b.id, b]));
    const deptMap = Object.fromEntries(departments.map((d) => [d.id, d]));

    const ranked = results.map((r, i) => {
      const student = studentMap[r.studentId];
      const branch = branchMap[r.branchId];
      const department = deptMap[r.departmentId];
      return {
        _id: r.id,
        id: r.id,
        value: r.value,
        is_published: r.isPublished,
        rank: i + 1,
        student_id: student
          ? { _id: student.id, id: student.id, name: student.name, enrollment_number: student.enrollmentNumber, year: student.year, semester: student.semester }
          : r.studentId,
        branch_id: branch ? { _id: branch.id, id: branch.id, name: branch.name, code: branch.code } : r.branchId,
        department_id: department ? { _id: department.id, id: department.id, name: department.name, code: department.code } : r.departmentId,
      };
    });
    return sendSuccess(res, ranked);
  } catch (err) {
    return sendError(res, err.message);
  }
};