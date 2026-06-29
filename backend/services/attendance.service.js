const Attendance = require('../models/Attendance');
const { ATTENDANCE_STATUS } = require('../config/constants');
const mongoose = require('mongoose');
const toObjectId = (id) => new mongoose.Types.ObjectId(id);

/**
 * Gets subject-wise attendance summary for a student.
 */
const getStudentSubjectAttendance = async (studentId) => {
  const result = await Attendance.aggregate([
    { $match: { student_id: toObjectId(studentId) } },
    {
      $group: {
        _id: '$subject_id',
        total: { $sum: 1 },
        present: { $sum: { $cond: [{ $eq: ['$status', ATTENDANCE_STATUS.PRESENT] }, 1, 0] } },
        absent:  { $sum: { $cond: [{ $eq: ['$status', ATTENDANCE_STATUS.ABSENT]  }, 1, 0] } },
        late:    { $sum: { $cond: [{ $eq: ['$status', ATTENDANCE_STATUS.LATE]    }, 1, 0] } },
      },
    },
    {
      $addFields: {
        percentage: {
          $cond: [
            { $gt: ['$total', 0] },
            { $round: [{ $multiply: [{ $divide: ['$present', '$total'] }, 100] }, 2] },
            0,
          ],
        },
      },
    },
    {
      $lookup: {
        from: 'subjects',
        localField: '_id',
        foreignField: '_id',
        as: 'subject',
      },
    },
    { $unwind: '$subject' },
    {
      $project: {
        subject_id: '$_id',
        subject_name: '$subject.name',
        subject_code: '$subject.code',
        total: 1,
        present: 1,
        absent: 1,
        late: 1,
        percentage: 1,
      },
    },
  ]);
  return result;
};

/**
 * Gets overall attendance percentage for a student.
 */
const getStudentOverallAttendance = async (studentId) => {
  const result = await Attendance.aggregate([
    { $match: { student_id: toObjectId(studentId) } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        present: { $sum: { $cond: [{ $eq: ['$status', ATTENDANCE_STATUS.PRESENT] }, 1, 0] } },
        absent:  { $sum: { $cond: [{ $eq: ['$status', ATTENDANCE_STATUS.ABSENT]  }, 1, 0] } },
        late:    { $sum: { $cond: [{ $eq: ['$status', ATTENDANCE_STATUS.LATE]    }, 1, 0] } },
      },
    },
    {
      $project: {
        total: 1,
        present: 1,
        absent: 1,
        late: 1,
        percentage: {
          $cond: [
            { $gt: ['$total', 0] },
            { $round: [{ $multiply: [{ $divide: ['$present', '$total'] }, 100] }, 2] },
            0,
          ],
        },
      },
    },
  ]);
  return result[0] || { total: 0, present: 0, absent: 0, late: 0, percentage: 0 };
};

/**
 * Gets month-wise attendance summary for a student, across all subjects.
 * @param {ObjectId} studentId
 * @param {Number} [monthsBack=6]
 */
const getStudentMonthlyAttendance = async (studentId, monthsBack = 6) => {
  const result = await Attendance.aggregate([
    { $match: { student_id: toObjectId(studentId) } },
    {
      $group: {
        _id: { year: { $year: '$date' }, month: { $month: '$date' } },
        total:   { $sum: 1 },
        present: { $sum: { $cond: [{ $eq: ['$status', ATTENDANCE_STATUS.PRESENT] }, 1, 0] } },
        absent:  { $sum: { $cond: [{ $eq: ['$status', ATTENDANCE_STATUS.ABSENT]  }, 1, 0] } },
        late:    { $sum: { $cond: [{ $eq: ['$status', ATTENDANCE_STATUS.LATE]    }, 1, 0] } },
      },
    },
    {
      $addFields: {
        percentage: {
          $cond: [
            { $gt: ['$total', 0] },
            { $round: [{ $multiply: [{ $divide: ['$present', '$total'] }, 100] }, 2] },
            0,
          ],
        },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
    {
      $project: {
        _id: 0,
        year: '$_id.year',
        month: '$_id.month',
        total: 1,
        present: 1,
        absent: 1,
        late: 1,
        percentage: 1,
      },
    },
  ]);

  const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const withLabels = result.map((r) => ({
    ...r,
    month_label: MONTH_LABELS[r.month - 1],
  }));

  return monthsBack ? withLabels.slice(-monthsBack) : withLabels;
};

/**
 * Gets week-wise attendance breakdown for a student (last N weeks).
 * Each entry represents one calendar week (Monday–Sunday).
 * @param {ObjectId} studentId
 * @param {Number} [weeksBack=8]
 * @returns {Array} [{ week_start, week_label, present, absent, late, total }]
 */
const getStudentWeeklyAttendance = async (studentId, weeksBack = 8) => {
  const result = await Attendance.aggregate([
    { $match: { student_id: toObjectId(studentId) } },
    {
      // $dayOfWeek: 1=Sun, 2=Mon … 7=Sat
      // We want Monday as first day of week.
      // daysFromMonday: Sun→6, Mon→0, Tue→1 … Sat→5
      $addFields: {
        daysFromMonday: {
          $mod: [
            { $add: [{ $subtract: [{ $dayOfWeek: '$date' }, 2] }, 7] },
            7,
          ],
        },
      },
    },
    {
      $addFields: {
        week_start: {
          $dateSubtract: {
            startDate: {
              $dateFromParts: {
                year:  { $year:        '$date' },
                month: { $month:       '$date' },
                day:   { $dayOfMonth:  '$date' },
              },
            },
            unit:   'day',
            amount: '$daysFromMonday',
          },
        },
      },
    },
    {
      $group: {
        _id:     '$week_start',
        present: { $sum: { $cond: [{ $eq: ['$status', ATTENDANCE_STATUS.PRESENT] }, 1, 0] } },
        absent:  { $sum: { $cond: [{ $eq: ['$status', ATTENDANCE_STATUS.ABSENT]  }, 1, 0] } },
        late:    { $sum: { $cond: [{ $eq: ['$status', ATTENDANCE_STATUS.LATE]    }, 1, 0] } },
        total:   { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        week_start: '$_id',
        present: 1,
        absent: 1,
        late: 1,
        total: 1,
      },
    },
  ]);

  // Attach human-readable label e.g. "Jun 2 – Jun 8"
  const fmt = (d) =>
    new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });

  const formatted = result.map((r) => {
    const end = new Date(r.week_start);
    end.setDate(end.getDate() + 6);
    return { ...r, week_label: `${fmt(r.week_start)} – ${fmt(end)}` };
  });

  return weeksBack ? formatted.slice(-weeksBack) : formatted;
};

/**
 * Gets attendance defaulters for a branch/year where percentage < threshold.
 */
const getBranchDefaulters = async (branchId, year, threshold = 75) => {
  const result = await Attendance.aggregate([
    { $match: { branch_id: toObjectId(branchId) } },
    {
      $group: {
        _id: '$student_id',
        total:   { $sum: 1 },
        present: { $sum: { $cond: [{ $eq: ['$status', ATTENDANCE_STATUS.PRESENT] }, 1, 0] } },
      },
    },
    {
      $addFields: {
        percentage: {
          $cond: [
            { $gt: ['$total', 0] },
            { $round: [{ $multiply: [{ $divide: ['$present', '$total'] }, 100] }, 2] },
            0,
          ],
        },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'student',
      },
    },
    { $unwind: '$student' },
    { $match: { 'student.year': Number(year) } },
    { $match: { percentage: { $lt: Number(threshold) } } },
    {
      $project: {
        student_id: '$_id',
        student_name: '$student.name',
        enrollment_number: '$student.enrollment_number',
        total: 1,
        present: 1,
        percentage: 1,
      },
    },
    { $sort: { percentage: 1 } },
  ]);
  return result;
};

module.exports = {
  getStudentSubjectAttendance,
  getStudentOverallAttendance,
  getStudentMonthlyAttendance,
  getStudentWeeklyAttendance,   // ← NEW export
  getBranchDefaulters,
};