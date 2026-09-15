const prisma = require('../config/prismaClient');

const calculateSGPA = async (studentId, streamId, year, semester) => {
  const pattern = await prisma.examPattern.findFirst({
    where: { streamId, year, semester },
    include: { components: true },
  });

  if (!pattern) return { sgpa: null, components: [] };

  const allMarks = await prisma.marks.findMany({
    where: { studentId, year, semester },
  });

  let totalWeightedMarks = 0;
  let totalWeightage = 0;
  const componentSummary = [];

  for (const component of pattern.components) {
    if (!component.includeInSgpa) continue;

    const marksDoc = allMarks.find((m) => m.examComponentId === component.id);
    const obtained = marksDoc ? marksDoc.totalMarks : 0;
    const maxMarks = component.maxMarks;
    const weightage = component.weightagePercent;

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

  const sgpa =
    totalWeightage > 0
      ? parseFloat(((totalWeightedMarks / totalWeightage) * 10).toFixed(2))
      : null;

  return { sgpa, components: componentSummary };
};

const calculateCGPA = async (studentId, streamId, maxYear = 4, semestersPerYear = 2) => {
  const semesterResults = [];

  for (let y = 1; y <= maxYear; y++) {
    for (let s = 1; s <= semestersPerYear; s++) {
      const result = await calculateSGPA(studentId, streamId, y, s);
      if (result.sgpa !== null) {
        semesterResults.push({ year: y, semester: s, sgpa: result.sgpa });
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