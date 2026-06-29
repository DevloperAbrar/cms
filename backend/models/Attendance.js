const mongoose = require('mongoose');
const { ATTENDANCE_STATUS } = require('../config/constants');

const attendanceSchema = new mongoose.Schema(
  {
    student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subject_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    year: { type: Number, required: true },
    date: { type: Date, required: true },
    slot: { type: String, trim: true, default: null }, // time slot string
    status: { type: String, enum: Object.values(ATTENDANCE_STATUS), required: true },
    marked_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

attendanceSchema.index({ student_id: 1, subject_id: 1, date: 1 }, { unique: true });
attendanceSchema.index({ branch_id: 1, subject_id: 1, date: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);