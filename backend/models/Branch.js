const mongoose = require('mongoose');
const { USER_STATUS } = require('../config/constants');

const branchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    department_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    status: { type: String, enum: [USER_STATUS.ACTIVE, USER_STATUS.INACTIVE], default: USER_STATUS.ACTIVE },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

branchSchema.index({ department_id: 1 });

module.exports = mongoose.model('Branch', branchSchema);