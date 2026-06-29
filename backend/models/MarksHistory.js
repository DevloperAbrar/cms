const mongoose = require('mongoose');

const marksHistorySchema = new mongoose.Schema(
  {
    marks_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Marks', required: true },
    changed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    previous_values: { type: mongoose.Schema.Types.Mixed, required: true },
    new_values: { type: mongoose.Schema.Types.Mixed, required: true },
    changed_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

marksHistorySchema.index({ marks_id: 1, changed_at: -1 });

module.exports = mongoose.model('MarksHistory', marksHistorySchema);