const mongoose = require('mongoose');

const subFieldEntrySchema = new mongoose.Schema(
  {
    sub_field_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    marks_obtained: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const marksSchema = new mongoose.Schema(
  {
    student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subject_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    year: { type: Number, required: true },
    semester: { type: Number, required: true },
    exam_component_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    sub_field_entries: [subFieldEntrySchema],
    total_marks: { type: Number, required: true, min: 0 },
    max_marks: { type: Number, required: true, min: 0 },
    submitted_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    locked: { type: Boolean, default: false },
    submitted_at: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

marksSchema.index(
  { student_id: 1, subject_id: 1, exam_component_id: 1 },
  { unique: true }
);
marksSchema.index({ branch_id: 1, year: 1, semester: 1 });

module.exports = mongoose.model('Marks', marksSchema);