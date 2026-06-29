const mongoose = require('mongoose');
const { QUIZ_STATUS, RESULT_VISIBILITY, RESULT_PUBLISH_MODE, QUESTION_TYPE } = require('../config/constants');

const optionSchema = new mongoose.Schema(
  {
    text: { type: String, trim: true, default: '' },
    image_path: { type: String, default: null },
    is_correct: { type: Boolean, default: false },
  },
  { _id: true }
);

const questionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    image_path: { type: String, default: null },
    type: { type: String, enum: Object.values(QUESTION_TYPE), default: QUESTION_TYPE.SINGLE },
    options: {
      type: [optionSchema],
      validate: {
        validator: (opts) => opts.length >= 2 && opts.length <= 6,
        message: 'Each question must have 2–6 options.',
      },
    },
    marks: { type: Number, required: true, min: 0 },
    negative_marks: { type: Number, default: 0, min: 0 },
  },
  { _id: true }
);

const quizSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    subject_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    year: { type: Number, required: true },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    start_time: { type: Date, required: true },
    end_time: { type: Date, required: true },
    duration_minutes: { type: Number, required: true, min: 1 },
    total_marks: { type: Number, required: true, min: 0 },
    negative_marking: { type: Boolean, default: false },
    negative_value: { type: Number, default: 0 },
    shuffle_questions: { type: Boolean, default: false },
    shuffle_options: { type: Boolean, default: false },
    attempts_allowed: { type: Number, default: 1, min: 1 },
    result_visibility: {
      type: String,
      enum: Object.values(RESULT_VISIBILITY),
      default: RESULT_VISIBILITY.IMMEDIATE,
    },
    // Faculty explicitly publishes results to students with a chosen mode
    result_publish_mode: {
      type: String,
      enum: Object.values(RESULT_PUBLISH_MODE),
      default: RESULT_PUBLISH_MODE.NONE,
    },
    questions: [questionSchema],
    status: { type: String, enum: Object.values(QUIZ_STATUS), default: QUIZ_STATUS.DRAFT },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

quizSchema.index({ branch_id: 1, year: 1, start_time: 1, end_time: 1 });
quizSchema.index({ created_by: 1, status: 1 });

module.exports = mongoose.model('Quiz', quizSchema);