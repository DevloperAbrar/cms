const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actor_role: { type: String, required: true },
    actor_name: { type: String, required: true },
    action: { type: String, required: true }, // e.g. 'CREATE', 'UPDATE', 'DELETE', 'LOCK', 'UNLOCK'
    resource_type: { type: String, required: true }, // e.g. 'User', 'Marks', 'Quiz'
    resource_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    ip_address: { type: String, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null }, // extra context
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false } // manual created_at only
);

auditLogSchema.index({ actor_id: 1, created_at: -1 });
auditLogSchema.index({ resource_type: 1, created_at: -1 });
auditLogSchema.index({ action: 1, created_at: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);