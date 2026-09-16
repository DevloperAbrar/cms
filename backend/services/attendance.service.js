const prisma = require('../config/prismaClient');

const getStudentSubjectAttendance = async (studentId) => {
  const rows = await prisma.$queryRaw`
    SELECT
      a."subjectId",
      s.name AS subject_name,
      s.code AS subject_code,
      COUNT(*) AS total,
      SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present,
      SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent,
      SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) AS late,
      ROUND(
        CASE WHEN COUNT(*) > 0
          THEN (SUM(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0 END) / COUNT(*)) * 100
          ELSE 0
        END, 2
      ) AS percentage
    FROM attendance a
    JOIN subjects s ON s.id = a."subjectId"
    WHERE a."studentId" = ${studentId}
    GROUP BY a."subjectId", s.name, s.code
  `;

  return rows.map((r) => ({
    subject_id: r.subjectid,
    subject_name: r.subject_name,
    subject_code: r.subject_code,
    total: Number(r.total),
    present: Number(r.present),
    absent: Number(r.absent),
    late: Number(r.late),
    percentage: Number(r.percentage),
  }));
};

const getStudentOverallAttendance = async (studentId) => {
  const rows = await prisma.$queryRaw`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present,
      SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) AS absent,
      SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) AS late,
      ROUND(
        CASE WHEN COUNT(*) > 0
          THEN (SUM(CASE WHEN status = 'present' THEN 1.0 ELSE 0 END) / COUNT(*)) * 100
          ELSE 0
        END, 2
      ) AS percentage
    FROM attendance
    WHERE "studentId" = ${studentId}
  `;

  const r = rows[0];
  if (!r || Number(r.total) === 0) {
    return { total: 0, present: 0, absent: 0, late: 0, percentage: 0 };
  }
  return {
    total: Number(r.total),
    present: Number(r.present),
    absent: Number(r.absent),
    late: Number(r.late),
    percentage: Number(r.percentage),
  };
};

const getStudentMonthlyAttendance = async (studentId, monthsBack = 6) => {
  const rows = await prisma.$queryRaw`
    SELECT
      EXTRACT(YEAR FROM date)::int AS year,
      EXTRACT(MONTH FROM date)::int AS month,
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present,
      SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) AS absent,
      SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) AS late,
      ROUND(
        CASE WHEN COUNT(*) > 0
          THEN (SUM(CASE WHEN status = 'present' THEN 1.0 ELSE 0 END) / COUNT(*)) * 100
          ELSE 0
        END, 2
      ) AS percentage
    FROM attendance
    WHERE "studentId" = ${studentId}
    GROUP BY EXTRACT(YEAR FROM date), EXTRACT(MONTH FROM date)
    ORDER BY EXTRACT(YEAR FROM date), EXTRACT(MONTH FROM date)
  `;

  const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const withLabels = rows.map((r) => ({
    year: Number(r.year),
    month: Number(r.month),
    month_label: MONTH_LABELS[Number(r.month) - 1],
    total: Number(r.total),
    present: Number(r.present),
    absent: Number(r.absent),
    late: Number(r.late),
    percentage: Number(r.percentage),
  }));

  return monthsBack ? withLabels.slice(-monthsBack) : withLabels;
};

const getStudentWeeklyAttendance = async (studentId, weeksBack = 8) => {
  const rows = await prisma.$queryRaw`
    SELECT
      date_trunc('week', date)::date AS week_start,
      SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present,
      SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) AS absent,
      SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) AS late,
      COUNT(*) AS total
    FROM attendance
    WHERE "studentId" = ${studentId}
    GROUP BY week_start
    ORDER BY week_start
  `;

  const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });

  const formatted = rows.map((r) => {
    const start = new Date(r.week_start);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return {
      week_start: r.week_start,
      week_label: `${fmt(start)} – ${fmt(end)}`,
      present: Number(r.present),
      absent: Number(r.absent),
      late: Number(r.late),
      total: Number(r.total),
    };
  });

  return weeksBack ? formatted.slice(-weeksBack) : formatted;
};

const getBranchDefaulters = async (branchId, year, threshold = 75) => {
  const rows = await prisma.$queryRaw`
    SELECT
      a."studentId",
      u.name AS student_name,
      u."enrollmentNumber" AS enrollment_number,
      COUNT(*) AS total,
      SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present,
      ROUND(
        CASE WHEN COUNT(*) > 0
          THEN (SUM(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0 END) / COUNT(*)) * 100
          ELSE 0
        END, 2
      ) AS percentage
    FROM attendance a
    JOIN users u ON u.id = a."studentId"
    WHERE a."branchId" = ${branchId}
      AND u.year = ${year}
    GROUP BY a."studentId", u.name, u."enrollmentNumber"
    HAVING (SUM(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0 END) / NULLIF(COUNT(*), 0)) * 100 < ${threshold}
    ORDER BY percentage
  `;

  return rows.map((r) => ({
    student_id: r.studentid,
    student_name: r.student_name,
    enrollment_number: r.enrollment_number,
    total: Number(r.total),
    present: Number(r.present),
    percentage: Number(r.percentage),
  }));
};

module.exports = {
  getStudentSubjectAttendance,
  getStudentOverallAttendance,
  getStudentMonthlyAttendance,
  getStudentWeeklyAttendance,
  getBranchDefaulters,
};