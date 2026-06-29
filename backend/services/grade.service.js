const Marks = require('../models/Marks');
const ExamPattern = require('../models/ExamPattern');

/**
 * Calculates SGPA for a student for a given semester.
 * Uses weighted average of components marked include_in_sgpa=true.
 * @param {ObjectId} studentId
 * @param {ObjectId} branchId  (used to find stream for ExamPattern)
 * @param {number} year
 * @param {number} semester
 * @param {ObjectId} streamId
 * @returns {{ sgpa: number, components: Array }}
 */
const calculateSGPA = async (studentId, streamId, year, semester) => {
  const pattern = await ExamPattern.findOne({ stream_id: streamId, year, semester });
  if (!pattern) return { sgpa: null, components: [] };

  const allMarks = await Marks.find({ student_id: studentId, year, semester });

  let totalWeightedMarks = 0;
  let totalWeightage = 0;
  const componentSummary = [];

  for (const component of pattern.components) {
    if (!component.include_in_sgpa) continue;

    const marksDoc = allMarks.find(
      (m) => m.exam_component_id.toString() === component._id.toString()
    );

    const obtained = marksDoc ? marksDoc.total_marks : 0;
    const maxMarks = component.max_marks;
    const weightage = component.weightage_percent;

    // Proportional contribution: (obtained / maxMarks) * weightage
    const contribution = maxMarks > 0 ? (obtained / maxMarks) * weightage : 0;
    totalWeightedMarks += contribution;
    totalWeightage += weightage;

    componentSummary.push({
      component_name: component.name,
      obtained,
      max_marks: maxMarks,
      weightage,
      contribution: parseFloat(contribution.toFixed(2)),
    });
  }

  // Scale to 10-point SGPA
  const sgpa =
    totalWeightage > 0
      ? parseFloat(((totalWeightedMarks / totalWeightage) * 10).toFixed(2))
      : null;

  return { sgpa, components: componentSummary };
};

/**
 * Calculates CGPA as average of all semester SGPAs.
 * @param {ObjectId} studentId
 * @param {ObjectId} streamId
 * @param {number} maxYear
 * @param {number} semestersPerYear - typically 2
 * @returns {{ cgpa: number, semesters: Array }}
 */
const calculateCGPA = async (studentId, streamId, maxYear = 4, semestersPerYear = 2) => {
  const semesterResults = [];

  for (let y = 1; y <= maxYear; y++) {
    for (let s = 1; s <= semestersPerYear; s++) {
      const semester = (y - 1) * semestersPerYear + s;
      const result = await calculateSGPA(studentId, streamId, y, semester);
      if (result.sgpa !== null) {
        semesterResults.push({ year: y, semester, sgpa: result.sgpa });
      }
    }
  }

  if (semesterResults.length === 0) return { cgpa: null, semesters: [] };

  const cgpa = parseFloat(
    (semesterResults.reduce((sum, r) => sum + r.sgpa, 0) / semesterResults.length).toFixed(2)
  );

  return { cgpa, semesters: semesterResults };
};

module.exports = { calculateSGPA, calculateCGPA };