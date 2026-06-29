const mongoose = require('mongoose');

const parentTokenSchema = new mongoose.Schema(
  {
    student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true, unique: true }, // unique: true here is enough
    expires_at: { type: Date, default: null },
    revoked: { type: Boolean, default: false },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// token index already created by unique:true above, so removed duplicate
// keeping only student_id index
parentTokenSchema.index({ student_id: 1 });

module.exports = mongoose.model('ParentToken', parentTokenSchema);