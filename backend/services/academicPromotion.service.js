const prisma = require('../config/prismaClient');

/**
 * Opens a new academic session for a college and marks the previous
 * "current" session as closed. Call this once a year, e.g. at admission time.
 */
async function openNewSession(collegeId, { label, startDate, endDate }) {
  return prisma.$transaction(async (tx) => {
    await tx.academicSession.updateMany({
      where: { collegeId, isCurrent: true },
      data: { isCurrent: false, status: 'closed' },
    });

    const session = await tx.academicSession.create({
      data: {
        collegeId,
        label,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: 'active',
        isCurrent: true,
      },
    });

    return session;
  });
}

/**
 * Promotes every ACTIVE student in a branch+year from the given session
 * into the next year of the new session. Final-year students are marked
 * 'graduated' instead of promoted. Students explicitly listed in
 * `repeaterStudentIds` stay in the same year (marked 'repeated').
 *
 * Nothing in the OLD session's StudentYearHistory, Marks, or Attendance rows
 * is touched — this only ever INSERTs new rows for the new session.
 */
async function promoteBranch({
  collegeId,
  branchId,
  fromSessionId,
  toSessionId,
  finalYearNumber,      // e.g. 4 for a B.Tech branch
  repeaterStudentIds = [],
}) {
  const currentRecords = await prisma.studentYearHistory.findMany({
    where: {
      collegeId,
      branchId,
      academicSessionId: fromSessionId,
      status: 'active',
    },
  });

  if (currentRecords.length === 0) {
    return { promoted: 0, graduated: 0, repeated: 0 };
  }

  const results = { promoted: 0, graduated: 0, repeated: 0 };

  await prisma.$transaction(async (tx) => {
    for (const record of currentRecords) {
      const isRepeater = repeaterStudentIds.includes(record.studentId);
      const isFinalYear = record.year >= finalYearNumber;

      if (isFinalYear && !isRepeater) {
        // Graduate: close out old record, no new-session row created.
        await tx.studentYearHistory.update({
          where: { id: record.id },
          data: { status: 'graduated' },
        });
        await tx.user.update({
          where: { id: record.studentId },
          data: { status: 'inactive' }, // keeps login/history but out of active rosters
        });
        results.graduated += 1;
        continue;
      }

      const nextYear = isRepeater ? record.year : record.year + 1;

      // Close the old record with the right audit status.
      await tx.studentYearHistory.update({
        where: { id: record.id },
        data: { status: isRepeater ? 'repeated' : 'promoted' },
      });

      // Insert the new session's placement.
      await tx.studentYearHistory.create({
        data: {
          collegeId,
          studentId: record.studentId,
          academicSessionId: toSessionId,
          branchId: record.branchId,
          year: nextYear,
          semester: record.semester ? record.semester + (isRepeater ? 0 : 2) : null,
          section: record.section,
          status: 'active',
          promotedFromId: record.id,
        },
      });

      // Keep User's convenience fields in sync for cheap "current roster" queries.
      await tx.user.update({
        where: { id: record.studentId },
        data: { year: nextYear },
      });

      isRepeater ? (results.repeated += 1) : (results.promoted += 1);
    }
  });

  return results;
}

/**
 * Enrolls a brand-new batch of students into year 1 of a session.
 * Expects an array of { name, email, enrollmentNumber, section } — password
 * reset flow / invite email is a separate concern, not handled here.
 */
async function enrollNewBatch({ collegeId, branchId, academicSessionId, students }) {
  return prisma.$transaction(async (tx) => {
    const created = [];
    for (const s of students) {
      const user = await tx.user.create({
        data: {
          collegeId,
          name: s.name,
          email: s.email,
          role: 'student',
          status: 'active',
          branchId,
          year: 1,
          section: s.section || null,
          enrollmentNumber: s.enrollmentNumber,
        },
      });

      await tx.studentYearHistory.create({
        data: {
          collegeId,
          studentId: user.id,
          academicSessionId,
          branchId,
          year: 1,
          section: s.section || null,
          status: 'active',
        },
      });

      created.push(user);
    }
    return created;
  });
}

module.exports = { openNewSession, promoteBranch, enrollNewBatch };