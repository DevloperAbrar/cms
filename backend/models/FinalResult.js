const mongoose = require('mongoose');

/**
 * One record per student per config.
 * Coordinator fills value, then publishes.
 * Once published, students/faculty/hod/parent can see it.
 */
const finalResultSchema = new mongoose.Schema(
  {
    config_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FinalResultConfig',
      required: true,
    },
    student_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    branch_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    department_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    year: { type: Number, required: true },
    semester: { type: Number, required: true },
    value: { type: Number, required: true, min: 0 },           // the CGPA/SGPA/percentage value
    is_published: { type: Boolean, default: false },           // coordinator publishes
    published_at: { type: Date, default: null },
    submitted_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// One result per student per config
finalResultSchema.index({ config_id: 1, student_id: 1 }, { unique: true });
finalResultSchema.index({ branch_id: 1, year: 1, semester: 1 });
finalResultSchema.index({ department_id: 1, year: 1, semester: 1 });
finalResultSchema.index({ config_id: 1, is_published: 1 });

module.exports = mongoose.model('FinalResult', finalResultSchema);