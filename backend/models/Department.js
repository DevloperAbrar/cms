const mongoose = require('mongoose');
const { USER_STATUS } = require('../config/constants');

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    stream_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Stream', required: true },
    status: { type: String, enum: [USER_STATUS.ACTIVE, USER_STATUS.INACTIVE], default: USER_STATUS.ACTIVE },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

departmentSchema.index({ stream_id: 1 });

module.exports = mongoose.model('Department', departmentSchema);