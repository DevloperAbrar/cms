const mongoose = require('mongoose');

const subFieldSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    max_marks: { type: Number, required: true, min: 0 },
    display_order: { type: Number, default: 0 },
  },
  { _id: true }
);

const marksComponentSchema = new mongoose.Schema(
  {
    faculty_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subject_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    year: { type: Number, required: true },
    exam_component_id: { type: mongoose.Schema.Types.ObjectId, required: true }, // references ExamPattern component subdoc _id
    sub_fields: [subFieldSchema],
    // Locks once first student marks are submitted
    structure_locked: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

marksComponentSchema.index(
  { faculty_id: 1, subject_id: 1, branch_id: 1, exam_component_id: 1 },
  { unique: true }
);

module.exports = mongoose.model('MarksComponent', marksComponentSchema);