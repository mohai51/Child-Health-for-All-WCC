const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    actorRole: {
      type: String,
      default: 'anonymous'
    },
    action: {
      type: String,
      required: true,
      index: true
    },
    resourceType: {
      type: String,
      required: true,
      index: true
    },
    resourceId: {
      type: String,
      default: null,
      index: true
    },
    result: {
      type: String,
      enum: ['SUCCESS', 'FAILURE', 'DENIED'],
      default: 'SUCCESS'
    },
    ipAddress: {
      type: String,
      default: null
    },
    userAgent: {
      type: String,
      default: null
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: { createdAt: 'timestamp', updatedAt: false }
  }
);

auditLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
