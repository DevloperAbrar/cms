const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    sender_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true },
    read_at: { type: Date, default: null },
    delivered_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

messageSchema.index({ sender_id: 1, recipient_id: 1, created_at: -1 });
messageSchema.index({ recipient_id: 1, read_at: 1 });

module.exports = mongoose.model('Message', messageSchema);