const mongoose = require('mongoose');

/**
 * A student's request to join a course — the record behind the course
 * details page's "Proceed to payment" button.
 *
 * Free courses skip straight to `completed` and the access grant is created
 * in the same request. Paid courses land in `pending`, which notifies the
 * admin team; confirming the payment from the admin dashboard is what
 * actually grants access. No payment gateway is wired up: `reference` is
 * where a real provider's transaction id would go.
 */
const enrollmentSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },

    status: {
      type: String,
      enum: ['pending', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },

    // Captured at checkout so a later price change cannot rewrite history.
    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    method: { type: String, default: '' }, // 'free' | 'upi' | 'card' | 'bank-transfer'
    reference: { type: String, default: '' },

    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    confirmedAt: { type: Date },
  },
  { timestamps: true }
);

// A student has at most one live enrolment per course; re-enrolling after a
// cancellation reuses the same row.
enrollmentSchema.index({ studentId: 1, courseId: 1 }, { unique: true });

enrollmentSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Enrollment', enrollmentSchema);
