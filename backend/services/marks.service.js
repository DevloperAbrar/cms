const prisma = require('../config/prismaClient');

const upsertMarks = async ({
  collegeId,
  studentId,
  subjectId,
  branchId,
  academicSessionId,
  year,
  semester,
  examComponentId,
  totalMarks,
  maxMarks,
  subFieldEntries,
  submittedBy,
}) => {
  // Lock check
  const lockedRecord = await prisma.marks.findFirst({
    where: {
      subjectId,
      branchId,
      year,
      examComponentId,
      locked: true,
    },
  });

  if (lockedRecord) {
    const err = new Error('This component is locked. Contact HOD to unlock.');
    err.statusCode = 403;
    throw err;
  }

  const existing = await prisma.marks.findUnique({
    where: {
      studentId_subjectId_examComponentId_academicSessionId: {
        studentId,
        subjectId,
        examComponentId,
        academicSessionId,
      },
    },
    include: { subFieldEntries: true },
  });

  if (existing?.locked) {
    const err = new Error('This component is locked. Contact HOD to unlock.');
    err.statusCode = 403;
    throw err;
  }

  let computedTotal = totalMarks;
  if (subFieldEntries && subFieldEntries.length > 0) {
    computedTotal = subFieldEntries.reduce((sum, sf) => sum + (sf.marks_obtained || 0), 0);
  }

  const previousValues = existing
    ? { totalMarks: existing.totalMarks, subFieldEntries: existing.subFieldEntries }
    : null;

  let marks;
  if (existing) {
    // Delete old subfield entries and update
    await prisma.marksSubFieldEntry.deleteMany({ where: { marksId: existing.id } });

    marks = await prisma.marks.update({
      where: { id: existing.id },
      data: {
        totalMarks: computedTotal,
        maxMarks,
        submittedById: submittedBy,
        submittedAt: new Date(),
        subFieldEntries: subFieldEntries?.length
          ? {
              create: subFieldEntries.map((sf) => ({
                subFieldId: sf.sub_field_id,
                marksObtained: sf.marks_obtained,
              })),
            }
          : undefined,
      },
      include: { subFieldEntries: true },
    });
  } else {
    marks = await prisma.marks.create({
      data: {
        collegeId,
        studentId,
        subjectId,
        branchId,
        academicSessionId,
        year,
        semester,
        examComponentId,
        totalMarks: computedTotal,
        maxMarks,
        submittedById: submittedBy,
        submittedAt: new Date(),
        subFieldEntries: subFieldEntries?.length
          ? {
              create: subFieldEntries.map((sf) => ({
                subFieldId: sf.sub_field_id,
                marksObtained: sf.marks_obtained,
              })),
            }
          : undefined,
      },
      include: { subFieldEntries: true },
    });
  }

  // History log
  if (previousValues) {
    await prisma.marksHistory.create({
      data: {
        collegeId,
        marksId: marks.id,
        changedById: submittedBy,
        previousValues: previousValues,
        newValues: { totalMarks: computedTotal, subFieldEntries },
      },
    });
  }

  // Lock sub-field structure on first submission
  if (subFieldEntries?.length) {
    await prisma.marksComponent.updateMany({
      where: {
        subjectId,
        branchId,
        year,
        examComponentId,
      },
      data: { structureLocked: true },
    });
  }

  return marks;
};

const lockComponent = async (subjectId, branchId, year, examComponentId) => {
  return prisma.marks.updateMany({
    where: { subjectId, branchId, year, examComponentId },
    data: { locked: true },
  });
};

const unlockComponent = async (subjectId, branchId, year, examComponentId) => {
  return prisma.marks.updateMany({
    where: { subjectId, branchId, year, examComponentId },
    data: { locked: false },
  });
};

module.exports = { upsertMarks, lockComponent, unlockComponent };