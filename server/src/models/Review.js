const mongoose = require('mongoose');

/**
 * A learner's rating and written review of a course. One per learner per
 * course — submitting again edits the existing review.
 *
 * Reviews go live immediately. Staff can hide one (it stays in the admin
 * list but disappears from the course page), edit it, or delete it.
 */
const reviewSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', trim: true, maxlength: 1000 },

    hidden: { type: Boolean, default: false, index: true },
    // Set when staff changed the wording or rating, so it is never presented
    // as the learner's own words without saying so.
    editedByAdmin: { type: Boolean, default: false },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    moderatedAt: { type: Date },
  },
  { timestamps: true }
);

reviewSchema.index({ courseId: 1, studentId: 1 }, { unique: true });
reviewSchema.index({ courseId: 1, hidden: 1, createdAt: -1 });

reviewSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Review', reviewSchema);
