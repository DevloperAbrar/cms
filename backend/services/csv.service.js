const csvParser = require('csv-parser');
const { Readable } = require('stream');
const prisma = require('../config/prismaClient');
const { ROLES, USER_STATUS } = require('../config/constants');

const parseCSVBuffer = (buffer) => {
  return new Promise((resolve, reject) => {
    const rows = [];
    Readable.from(buffer.toString())
      .pipe(csvParser())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
};

const processStudentCSV = async (buffer, collegeId) => {
  const rows = await parseCSVBuffer(buffer);

  console.log('Total rows parsed:', rows.length);
  if (rows.length > 0) {
    console.log('First row sample:', JSON.stringify(rows[0]));
    console.log('Headers found:', Object.keys(rows[0]));
  }

  const [streams, departments, branches, existingUsers] = await Promise.all([
    prisma.stream.findMany({ where: { collegeId } }),
    prisma.department.findMany({ where: { collegeId } }),
    prisma.branch.findMany({ where: { collegeId } }),
    prisma.user.findMany({
      where: { collegeId, role: ROLES.STUDENT },
      select: { email: true, enrollmentNumber: true },
    }),
  ]);

  console.log('Streams in DB:', streams.map(s => s.code));
  console.log('Departments in DB:', departments.map(d => d.code));
  console.log('Branches in DB:', branches.map(b => b.code));

  const existingEmails = new Set(existingUsers.map(u => u.email));
  const existingEnrollments = new Set(existingUsers.map(u => u.enrollmentNumber).filter(Boolean));

  const toInsert = [];
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const rowErrors = [];

    const email = row.email?.toLowerCase().trim();
    const name = row.name?.trim();
    const enrollmentNo = row.enrollment_no?.trim();
    const phone = row.phone?.trim();
    const streamCode = row.stream_code?.toUpperCase().trim();
    const deptCode = row.dept_code?.toUpperCase().trim();
    const branchCode = row.branch_code?.toUpperCase().trim();
    const year = parseInt(row.year, 10);
    const section = row.section?.trim() || null;
    const semester = parseInt(row.semester, 10);

    if (!name) rowErrors.push('Name is required');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) rowErrors.push('Invalid email');
    if (!enrollmentNo) rowErrors.push('Enrollment number is required');
    if (existingEmails.has(email)) rowErrors.push('Duplicate email');
    if (existingEnrollments.has(enrollmentNo)) rowErrors.push('Duplicate enrollment number');

    const stream = streams.find((s) => s.code === streamCode);
    if (!stream) rowErrors.push(`Unknown stream code: ${streamCode}`);

    const dept = departments.find((d) => d.code === deptCode);
    if (!dept) rowErrors.push(`Unknown department code: ${deptCode}`);

    const branch = branches.find((b) => b.code === branchCode);
    if (!branch) rowErrors.push(`Unknown branch code: ${branchCode}`);

    if (isNaN(year) || year < 1 || year > 6) rowErrors.push('Invalid year');
    if (isNaN(semester) || semester < 1 || semester > 12) rowErrors.push('Invalid semester');

    if (rowErrors.length > 0) {
      errors.push({ row: rowNum, email: email || '', errors: rowErrors });
      continue;
    }

    existingEmails.add(email);
    existingEnrollments.add(enrollmentNo);

    toInsert.push({
      collegeId,
      name,
      email,
      enrollmentNumber: enrollmentNo,
      phone: phone || null,
      role: ROLES.STUDENT,
      status: USER_STATUS.ACTIVE,
      departmentId: dept.id,
      branchId: branch.id,
      year,
      section,
      semester,
    });
  }

  console.log('To insert:', toInsert.length, 'Errors:', errors.length);
  if (errors.length > 0) {
    console.log('First error:', JSON.stringify(errors[0]));
  }

  if (toInsert.length > 0) {
    // createMany doesn't run per-row validation the way insertMany did, but rows were
    // already de-duplicated against existingEmails/existingEnrollments above.
    await prisma.user.createMany({ data: toInsert, skipDuplicates: true });
  }

  return { imported: toInsert.length, skipped: errors.length, errors };
};

const parseMarksCSV = async (buffer) => {
  const rows = await parseCSVBuffer(buffer);
  return rows.map((row) => {
    const result = { enrollment_no: row.enrollment_no?.trim() };

    if (row.marks_obtained !== undefined) {
      result.max_marks = parseFloat(row.max_marks);
      result.marks_obtained = parseFloat(row.marks_obtained);
      result.sub_field_entries = [];
    } else {
      const sfEntries = [];
      const keys = Object.keys(row);
      const markKeys = keys.filter((k) => k.endsWith('_marks') && !k.startsWith('max'));
      for (const mk of markKeys) {
        const sfName = mk.replace('_marks', '');
        sfEntries.push({
          name: sfName,
          marks_obtained: parseFloat(row[mk] || 0),
          max: parseFloat(row[`${sfName}_max`] || 0),
        });
      }
      result.sub_field_entries = sfEntries;
      result.max_marks = sfEntries.reduce((s, sf) => s + sf.max, 0);
      result.marks_obtained = sfEntries.reduce((s, sf) => s + sf.marks_obtained, 0);
    }

    return result;
  });
};

module.exports = { processStudentCSV, parseMarksCSV };