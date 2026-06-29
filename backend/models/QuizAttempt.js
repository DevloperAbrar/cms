const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema(
  {
    question_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    selected_options: [{ type: mongoose.Schema.Types.ObjectId }],
  },
  { _id: false }
);

const quizAttemptSchema = new mongoose.Schema(
  {
    quiz_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    started_at: { type: Date, default: Date.now },
    submitted_at: { type: Date, default: null },
    answers: [answerSchema],
    score: { type: Number, default: null },
    is_auto_submitted: { type: Boolean, default: false },
    attempt_number: { type: Number, default: 1 },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

quizAttemptSchema.index({ quiz_id: 1, student_id: 1 });

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);