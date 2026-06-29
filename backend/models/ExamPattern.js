const mongoose = require('mongoose');
const { ENTERED_BY } = require('../config/constants');

const componentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    max_marks: { type: Number, required: true, min: 0 },
    weightage_percent: { type: Number, required: true, min: 0, max: 100 },
    entered_by: { type: String, enum: Object.values(ENTERED_BY), required: true },
    include_in_sgpa: { type: Boolean, default: true },
    pass_marks: { type: Number, default: 0 },
  },
  { _id: true }
);

const examPatternSchema = new mongoose.Schema(
  {
    stream_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Stream', required: true },
    year: { type: Number, required: true, min: 1, max: 6 },
    semester: { type: Number, required: true, min: 1, max: 12 },
    components: [componentSchema],
    // true once any marks submission starts; superadmin can force-unlock
    locked: { type: Boolean, default: false },
    force_unlock_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    sgpa_formula: {
      type: String,
      default: 'weighted_average', // configurable per stream
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

examPatternSchema.index({ stream_id: 1, year: 1, semester: 1 }, { unique: true });

module.exports = mongoose.model('ExamPattern', examPatternSchema);