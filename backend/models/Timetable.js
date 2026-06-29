const mongoose = require('mongoose');
const { TIMETABLE_STATUS } = require('../config/constants');

const slotSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      required: true,
    },
    time_slot: { type: String, required: true, trim: true }, // e.g. "09:00-10:00"
    subject_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    faculty_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    room: { type: String, trim: true, default: '' },
    is_lab: { type: Boolean, default: false },
  },
  { _id: true }
);

const timetableSchema = new mongoose.Schema(
  {
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    year: { type: Number, required: true, min: 1, max: 6 },
    section: { type: String, trim: true, default: null },
    academic_year: { type: String, required: true, trim: true }, // e.g. "2024-25"
    semester: { type: Number, required: true, min: 1, max: 12 },
    slots: [slotSchema],
    status: { type: String, enum: Object.values(TIMETABLE_STATUS), default: TIMETABLE_STATUS.DRAFT },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    published_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

timetableSchema.index({ branch_id: 1, year: 1, semester: 1, academic_year: 1 });

module.exports = mongoose.model('Timetable', timetableSchema);