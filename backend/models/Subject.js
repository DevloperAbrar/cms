const mongoose = require('mongoose');
const { USER_STATUS, SUBJECT_TYPE } = require('../config/constants');

const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    year: { type: Number, required: true, min: 1, max: 6 },
    semester: { type: Number, required: true, min: 1, max: 12 },
    type: { type: String, enum: Object.values(SUBJECT_TYPE), default: SUBJECT_TYPE.THEORY },
    credits: { type: Number, default: 0 },
    status: { type: String, enum: [USER_STATUS.ACTIVE, USER_STATUS.INACTIVE], default: USER_STATUS.ACTIVE },
    assigned_faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

subjectSchema.index({ branch_id: 1, year: 1, semester: 1 });

module.exports = mongoose.model('Subject', subjectSchema);