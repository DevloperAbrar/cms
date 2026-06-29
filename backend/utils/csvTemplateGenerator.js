const { Parser } = require('json2csv');

/**
 * Generates a CSV template buffer for marks entry.
 * @param {Array} students - [{ enrollment_number, name }]
 * @param {Array} subFields - [{ name, max_marks }] or empty for simple
 * @param {number} maxMarks - used when no sub-fields
 * @returns {Buffer}
 */
const generateMarksCSVTemplate = (students, subFields = [], maxMarks = 100) => {
  const hasSubFields = subFields.length > 0;

  let fields;
  let data;

  if (hasSubFields) {
    // Build dynamic columns per sub-field
    const sfFields = subFields.flatMap((sf) => [
      `${sf.name}_max(${sf.max_marks})`,
      `${sf.name}_marks`,
    ]);
    fields = ['enrollment_no', 'student_name', ...sfFields];

    data = students.map((s) => {
      const row = {
        enrollment_no: s.enrollment_number,
        student_name: s.name,
      };
      subFields.forEach((sf) => {
        row[`${sf.name}_max(${sf.max_marks})`] = sf.max_marks; // pre-filled and should be locked
        row[`${sf.name}_marks`] = '';
      });
      return row;
    });
  } else {
    fields = ['enrollment_no', 'student_name', 'max_marks', 'marks_obtained'];
    data = students.map((s) => ({
      enrollment_no: s.enrollment_number,
      student_name: s.name,
      max_marks: maxMarks,
      marks_obtained: '',
    }));
  }

  const parser = new Parser({ fields });
  return Buffer.from(parser.parse(data), 'utf-8');
};

/**
 * Generates a student upload template CSV.
 * @returns {Buffer}
 */
const generateStudentCSVTemplate = () => {
  const fields = [
    'name',
    'email',
    'enrollment_no',
    'phone',
    'stream_code',
    'dept_code',
    'branch_code',
    'year',
    'section',
    'semester',
  ];

  const example = [
    {
      name: 'John Doe',
      email: 'john@example.com',
      enrollment_no: 'BT2021001',
      phone: '9876543210',
      stream_code: 'BT',
      dept_code: 'CSE',
      branch_code: 'CSAI',
      year: 2,
      section: 'A',
      semester: 3,
    },
  ];

  const parser = new Parser({ fields });
  return Buffer.from(parser.parse(example), 'utf-8');
};

module.exports = { generateMarksCSVTemplate, generateStudentCSVTemplate };