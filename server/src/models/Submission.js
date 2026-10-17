const mongoose = require('mongoose');

/**
 * A task a student hands in for review.
 *
 * Work is submitted as a Google Drive link rather than a file upload, so
 * nothing large is stored here and the student keeps ownership of the
 * original. The trade-off is that a link can point anywhere or be
 * permission-locked, which is why the controller validates the host and the
 * UI insists on "Anyone with the link – Viewer".
 */

/**
 * Categories offered in the submission form. Kept server-side so the list
 * cannot be bypassed by posting an arbitrary string, and exported so the
 * client builds its dropdown from exactly the same values.
 */
const CATEGORIES = [
  'Python',
  'SQL',
  'Power BI',
  'Excel',
  'Machine Learning',
  'Other Technology',
  'Blog',
  'Project',
  'Capstone',
  'Other',
];

const STATUSES = ['submitted', 'under_review', 'accepted', 'needs_revision'];

const submissionSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    category: { type: String, enum: CATEGORIES, required: true, index: true },
    title: { type: String, default: '', trim: true },
    description: { type: String, required: true, trim: true },

    driveLink: { type: String, required: true, trim: true },

    // Optional tie to the course the work belongs to.
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },

    // Set when the work answers an admin-set assignment.
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', index: true },

    status: { type: String, enum: STATUSES, default: 'submitted', index: true },

    // Reviewer's notes back to the student.
    feedback: { type: String, default: '' },
    // Out of the assignment's maxScore (100 when there is no assignment).
    score: { type: Number, min: 0, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

// The admin queue is "newest first, optionally filtered by status".
submissionSchema.index({ status: 1, createdAt: -1 });
submissionSchema.index({ studentId: 1, createdAt: -1 });

submissionSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

const Submission = mongoose.model('Submission', submissionSchema);

Submission.CATEGORIES = CATEGORIES;
Submission.STATUSES = STATUSES;

module.exports = Submission;
