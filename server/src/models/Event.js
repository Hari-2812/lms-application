const mongoose = require('mongoose');

/**
 * A scheduled activity students should know about: a webinar, workshop,
 * batch start, placement drive or any other dated programme.
 *
 * Admin-authored through the dashboard; students only ever read these.
 */
const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },

    // Short plain-text blurb for the card.
    summary: { type: String, default: '' },
    // Formatted long copy, sanitised on write like course descriptions.
    descriptionHtml: { type: String, default: '' },

    type: {
      type: String,
      enum: ['webinar', 'workshop', 'program', 'placement', 'other'],
      default: 'webinar',
      index: true,
    },

    startsAt: { type: Date, required: true, index: true },
    // Optional: a one-off talk has no meaningful end time.
    endsAt: { type: Date },

    // "Online", "Zoom", a campus name — free text so it suits either.
    location: { type: String, default: '' },
    // Joining link. Shown only once the event is close, see the controller.
    joinUrl: { type: String, default: '' },

    host: { type: String, default: '' },
    // Optional tie to a course, so it can be targeted at that course's students.
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },

    // Draft events stay out of the student-facing list.
    published: { type: Boolean, default: true, index: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// The student list is always "published, ordered by when it starts".
eventSchema.index({ published: 1, startsAt: 1 });

eventSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Event', eventSchema);
