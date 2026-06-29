const Marks = require('../models/Marks');
const MarksHistory = require('../models/MarksHistory');
const MarksComponent = require('../models/MarksComponent');
const ExamPattern = require('../models/ExamPattern');

/**
 * Upserts marks for a student+subject+component.
 * Handles sub-field auto-calculation, lock check, and history logging.
 * @param {object} params
 * @returns {object} updated Marks document
 */
const upsertMarks = async ({
  studentId,
  subjectId,
  branchId,
  year,
  semester,
  examComponentId,
  totalMarks,
  maxMarks,
  subFieldEntries,
  submittedBy,
}) => {
  // ── Lock check ────────────────────────────────────────────────────────────
  // Check component-level lock: if ANY record for this component is locked,
  // the whole component is locked — even for students with no marks yet.
  const lockedRecord = await Marks.findOne({
    subject_id: subjectId,
    branch_id: branchId,
    year,
    exam_component_id: examComponentId,
    locked: true,
  });

  if (lockedRecord) {
    const err = new Error('This component is locked. Contact HOD to unlock.');
    err.statusCode = 403;
    throw err;
  }

  // Also check the specific student's record in case only theirs is locked
  const existing = await Marks.findOne({
    student_id: studentId,
    subject_id: subjectId,
    exam_component_id: examComponentId,
  });

  if (existing?.locked) {
    const err = new Error('This component is locked. Contact HOD to unlock.');
    err.statusCode = 403;
    throw err;
  }

  // ── Sub-field auto-total ──────────────────────────────────────────────────
  let computedTotal = totalMarks;
  if (subFieldEntries && subFieldEntries.length > 0) {
    computedTotal = subFieldEntries.reduce((sum, sf) => sum + (sf.marks_obtained || 0), 0);
  }

  const previousValues = existing
    ? { total_marks: existing.total_marks, sub_field_entries: existing.sub_field_entries }
    : null;

  const marksData = {
    student_id: studentId,
    subject_id: subjectId,
    branch_id: branchId,
    year,
    semester,
    exam_component_id: examComponentId,
    total_marks: computedTotal,
    max_marks: maxMarks,
    submitted_by: submittedBy,
    submitted_at: new Date(),
    ...(subFieldEntries?.length ? { sub_field_entries: subFieldEntries } : {}),
  };

  const marks = await Marks.findOneAndUpdate(
    { student_id: studentId, subject_id: subjectId, exam_component_id: examComponentId },
    { $set: marksData },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // ── History log ───────────────────────────────────────────────────────────
  if (previousValues) {
    await MarksHistory.create({
      marks_id: marks._id,
      changed_by: submittedBy,
      previous_values: previousValues,
      new_values: { total_marks: computedTotal, sub_field_entries: subFieldEntries },
    });
  }

  // ── Lock sub-field structure on first submission ───────────────────────────
  if (subFieldEntries?.length) {
    await MarksComponent.findOneAndUpdate(
      {
        subject_id: subjectId,
        branch_id: branchId,
        year,
        exam_component_id: examComponentId,
      },
      { $set: { structure_locked: true } }
    );
  }

  return marks;
};

/**
 * Locks all marks for a given component (HOD action).
 */
const lockComponent = async (subjectId, branchId, year, examComponentId) => {
  const result = await Marks.updateMany(
    { subject_id: subjectId, branch_id: branchId, year, exam_component_id: examComponentId },
    { $set: { locked: true } }
  );
  return result;
};

/**
 * Unlocks all marks for a given component (HOD action).
 */
const unlockComponent = async (subjectId, branchId, year, examComponentId) => {
  const result = await Marks.updateMany(
    { subject_id: subjectId, branch_id: branchId, year, exam_component_id: examComponentId },
    { $set: { locked: false } }
  );
  return result;
};

module.exports = { upsertMarks, lockComponent, unlockComponent };