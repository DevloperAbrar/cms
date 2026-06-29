const mongoose = require('mongoose');
const { ATTENDANCE_STATUS } = require('../config/constants');

const facultyAttendanceSchema = new mongoose.Schema(
  {
    faculty_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    department_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    date:        { type: Date, required: true },
    status:      { type: String, enum: Object.values(ATTENDANCE_STATUS), required: true },
    note:        { type: String, trim: true, default: null }, // optional HOD note
    marked_by:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// One record per faculty per day
facultyAttendanceSchema.index({ faculty_id: 1, date: 1 }, { unique: true });
facultyAttendanceSchema.index({ department_id: 1, date: 1 });

module.exports = mongoose.model('FacultyAttendance', facultyAttendanceSchema);