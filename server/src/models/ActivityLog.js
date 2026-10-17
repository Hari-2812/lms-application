const mongoose = require('mongoose');

/**
 * An append-only record of a key change made by staff: pricing, publishing,
 * enrolment, payment edits, learner status, settings, team and security
 * events. Written by services/activityService; read on the admin Activity
 * log page. Never edited or deleted from the app.
 */
const CATEGORIES = [
  'pricing',
  'publishing',
  'course',
  'enrolment',
  'payment',
  'learner',
  'certificate',
  'task',
  'settings',
  'team',
  'security',
];

const activityLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    // Denormalised so the log still reads correctly after an account is removed.
    actorName: { type: String, default: 'System' },
    actorEmail: { type: String, default: '' },

    category: { type: String, enum: CATEGORIES, required: true, index: true },
    action: { type: String, required: true },
    summary: { type: String, required: true },

    entityType: { type: String, default: '' },
    entityId: { type: String, default: '' },
    meta: { type: mongoose.Schema.Types.Mixed },

    ip: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activityLogSchema.index({ createdAt: -1 });

activityLogSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
ActivityLog.CATEGORIES = CATEGORIES;

module.exports = ActivityLog;
