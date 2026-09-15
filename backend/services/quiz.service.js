const prisma = require('../config/prismaClient');

const checkQuizConflict = async (branchId, year, startTime, endTime, excludeId = null) => {
  const where = {
    branchId,
    year,
    status: 'published',
    NOT: excludeId ? { id: excludeId } : undefined,
    AND: [
      { startTime: { lt: new Date(endTime) } },
      { endTime: { gt: new Date(startTime) } },
    ],
  };

  const conflict = await prisma.quiz.findFirst({ where });
  return conflict;
};

const scoreAttempt = (quiz, answers) => {
  let score = 0;

  for (const question of quiz.questions) {
    const studentAnswer = answers.find(
      (a) => a.question_id === question.id || a.question_id === question._id?.toString()
    );
    if (!studentAnswer) continue;

    const correctOptionIds = question.options
      .filter((o) => o.isCorrect)
      .map((o) => o.id);

    const selectedIds = studentAnswer.selected_options || studentAnswer.selectedOptionIds || [];

    const isCorrect =
      correctOptionIds.length === selectedIds.length &&
      correctOptionIds.every((id) => selectedIds.includes(id));

    if (isCorrect) {
      score += question.marks;
    } else if (quiz.negativeMarking && selectedIds.length > 0) {
      score -= question.negativeMarks || 0;
    }
  }

  return Math.max(0, score);
};

module.exports = { checkQuizConflict, scoreAttempt };