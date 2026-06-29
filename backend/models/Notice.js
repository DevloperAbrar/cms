const mongoose = require('mongoose');
const { NOTICE_PRIORITY, NOTICE_TARGET_TYPE } = require('../config/constants');

const noticeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    priority: {
      type: String,
      enum: Object.values(NOTICE_PRIORITY),
      default: NOTICE_PRIORITY.NORMAL,
    },
    posted_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    target_type: {
      type: String,
      enum: Object.values(NOTICE_TARGET_TYPE),
      required: true,
    },
    // Array of ObjectIds matching target_type (branch_ids, dept_ids, user_ids, etc.)
    target_ids: [{ type: mongoose.Schema.Types.ObjectId }],
    schedule_at: { type: Date, default: null },
    expires_at: { type: Date, default: null },
    read_by: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

noticeSchema.index({ target_ids: 1, expires_at: 1 });
noticeSchema.index({ posted_by: 1, created_at: -1 });

module.exports = mongoose.model('Notice', noticeSchema);