const mongoose = require('mongoose');

/**
 * SuperAdmin creates one config per year+semester combination.
 * Defines what metric coordinators will fill (CGPA, SGPA, percentage, grade, etc.)
 * and sets max/passing values.
 */
const finalResultConfigSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },       // e.g. "CGPA", "SGPA", "Percentage"
    metric_type: {
      type: String,
      enum: ['cgpa', 'sgpa', 'percentage', 'grade', 'custom'],
      required: true,
    },
    year: { type: Number, required: true, min: 1, max: 6 },
    semester: { type: Number, required: true, min: 1, max: 8 },
    max_value: { type: Number, required: true },               // e.g. 10 for CGPA, 100 for percentage
    passing_value: { type: Number, required: true },           // e.g. 4.0 for CGPA, 40 for percentage
    decimal_places: { type: Number, default: 2 },              // how many decimals to allow
    is_active: { type: Boolean, default: true },               // superadmin can disable
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// A college can have multiple configs per year+semester (e.g. both CGPA and percentage)
finalResultConfigSchema.index({ year: 1, semester: 1, metric_type: 1 });

module.exports = mongoose.model('FinalResultConfig', finalResultConfigSchema);