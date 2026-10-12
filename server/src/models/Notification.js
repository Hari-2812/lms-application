const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: [
        'access_granted',
        'access_revoked',
        'new_lesson',
        'progress_milestone',
        'announcement',
        // Course content the admin changed after students enrolled.
        'course_update',
        // Certificate issued / sample generated.
        'certificate',
        // Assignment or action the student needs to take.
        'task',
        // Live session, webinar, batch start.
        'event',
        // Enrolment and payment status changes.
        'payment',
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },

    /**
     * Where clicking the notification should take the student. Falls back to
     * the course page when absent, which is what every pre-`link`
     * notification relies on — see DashboardHeader's onNotificationClick.
     * Always an in-app path, never an absolute URL.
     */
    link: { type: String, default: '' },

    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });

notificationSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Notification', notificationSchema);
