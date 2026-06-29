const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const { QUIZ_STATUS, RESULT_VISIBILITY } = require('../config/constants');

/**
 * Checks for published quiz conflicts when publishing a new quiz.
 * Same branch + year + overlapping time window = conflict.
 * @returns {object|null} conflicting quiz or null
 */
const checkQuizConflict = async (branchId, year, startTime, endTime, excludeId = null) => {
  const query = {
    branch_id: branchId,
    year,
    status: QUIZ_STATUS.PUBLISHED,
    $or: [
      { start_time: { $lt: endTime, $gte: startTime } },
      { end_time: { $gt: startTime, $lte: endTime } },
      { start_time: { $lte: startTime }, end_time: { $gte: endTime } },
    ],
  };

  if (excludeId) query._id = { $ne: excludeId };

  const conflict = await Quiz.findOne(query)
    .populate('created_by', 'name')
    .select('title start_time end_time created_by')
    .lean();

  return conflict;
};

/**
 * Scores a submitted quiz attempt.
 * @param {object} quiz - Full quiz document with questions
 * @param {Array} answers - [{ question_id, selected_options }]
 * @returns {number} score
 */
const scoreAttempt = (quiz, answers) => {
  let score = 0;

  for (const answer of answers) {
    const question = quiz.questions.find(
      (q) => q._id.toString() === answer.question_id.toString()
    );
    if (!question) continue;

    const correctOptionIds = question.options
      .filter((o) => o.is_correct)
      .map((o) => o._id.toString());

    const selectedIds = (answer.selected_options || []).map((id) => id.toString());

    const isCorrect =
      correctOptionIds.length === selectedIds.length &&
      correctOptionIds.every((id) => selectedIds.includes(id));

    if (isCorrect) {
      score += question.marks;
    } else if (selectedIds.length > 0 && quiz.negative_marking) {
      const penalty = question.negative_marks > 0 ? question.negative_marks : quiz.negative_value;
      score -= penalty;
    }
  }

  return Math.max(0, score); // score cannot go below 0
};

/**
 * Gets active quizzes for a student (branch + year, currently live).
 */
const getActiveQuizzesForStudent = async (branchId, year) => {
  const now = new Date();
  return Quiz.find({
    branch_id: branchId,
    year,
    status: QUIZ_STATUS.PUBLISHED,
    start_time: { $lte: now },
    end_time: { $gte: now },
  })
    .select('title subject_id start_time end_time duration_minutes total_marks attempts_allowed')
    .populate('subject_id', 'name code')
    .lean();
};

module.exports = { checkQuizConflict, scoreAttempt, getActiveQuizzesForStudent };