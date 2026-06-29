const PDFDocument = require('pdfkit');

/**
 * Generates an attendance PDF report as a Buffer.
 * @param {object} student - { name, enrollment_number, branch, year }
 * @param {Array} subjectAttendance - from attendanceService.getStudentSubjectAttendance
 * @param {object} overall - { total, present, percentage }
 * @returns {Buffer}
 */
const generateAttendancePDF = (student, subjectAttendance, overall) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Header
    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('CampusCMS — Attendance Report', { align: 'center' });
    doc.moveDown(0.5);

    // Student info
    doc.fontSize(11).font('Helvetica');
    doc.text(`Student: ${student.name}`);
    doc.text(`Enrollment: ${student.enrollment_number}`);
    doc.text(`Branch: ${student.branch}  |  Year: ${student.year}`);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`);
    doc.moveDown();

    // Overall summary
    doc.fontSize(13).font('Helvetica-Bold').text('Overall Attendance');
    doc.fontSize(11).font('Helvetica');
    doc.text(`Total Classes: ${overall.total}`);
    doc.text(`Present: ${overall.present}`);
    doc.text(
      `Attendance: ${overall.percentage}% ${overall.percentage < 75 ? '⚠ Below 75%' : '✓'}`
    );
    doc.moveDown();

    // Subject-wise table
    doc.fontSize(13).font('Helvetica-Bold').text('Subject-Wise Attendance');
    doc.moveDown(0.3);

    const tableTop = doc.y;
    const cols = { subject: 40, total: 260, present: 320, absent: 380, pct: 440 };

    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Subject', cols.subject, tableTop);
    doc.text('Total', cols.total, tableTop);
    doc.text('Present', cols.present, tableTop);
    doc.text('Absent', cols.absent, tableTop);
    doc.text('%', cols.pct, tableTop);

    doc
      .moveTo(40, tableTop + 14)
      .lineTo(540, tableTop + 14)
      .stroke();

    let y = tableTop + 20;
    doc.font('Helvetica');

    for (const row of subjectAttendance) {
      if (y > 720) {
        doc.addPage();
        y = 40;
      }
      doc.text(row.subject_name.substring(0, 30), cols.subject, y);
      doc.text(String(row.total), cols.total, y);
      doc.text(String(row.present), cols.present, y);
      doc.text(String(row.absent), cols.absent, y);
      doc.text(`${row.percentage}%`, cols.pct, y);
      y += 18;
    }

    doc.end();
  });
};

module.exports = { generateAttendancePDF };