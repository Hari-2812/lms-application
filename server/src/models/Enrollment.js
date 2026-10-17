const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * A student's request to join a course — the record behind the course
 * details page's "Proceed to payment" button, and the transaction the admin
 * Payments page lists.
 *
 * Free courses skip straight to `completed` and the access grant is created
 * in the same request. Paid courses land in `pending` and become `completed`
 * (successful) either when the gateway confirms the payment or when an admin
 * marks it paid; either way the learner is enrolled automatically. A
 * declined or abandoned gateway payment becomes `failed`.
 */
const STATUSES = ['pending', 'completed', 'failed', 'cancelled'];

const historySchema = new mongoose.Schema(
  {
    status: { type: String, enum: STATUSES },
    note: { type: String, default: '' },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const enrollmentSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },

    status: { type: String, enum: STATUSES, default: 'pending', index: true },

    // Human-readable id shown to the learner and the admin, e.g. TXN-20261016-7F3C9B.
    transactionId: { type: String, unique: true, sparse: true },

    // Captured at checkout so a later price change cannot rewrite history.
    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    method: { type: String, default: '' }, // 'free' | 'upi' | 'card' | 'netbanking' | 'bank-transfer' | 'razorpay'
    // The gateway's payment id, or the bank / UPI reference an admin typed in.
    reference: { type: String, default: '' },

    gateway: { type: String, default: 'manual' }, // 'manual' | 'razorpay'
    gatewayOrderId: { type: String, index: true, sparse: true },
    failureReason: { type: String, default: '' },
    attempts: { type: Number, default: 1 },

    // Every status change, newest last — the per-learner payment history.
    history: { type: [historySchema], default: [] },

    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    confirmedAt: { type: Date },
  },
  { timestamps: true }
);

// A student has at most one live enrolment per course; re-enrolling after a
// cancellation or failure reuses the same row (and its history).
enrollmentSchema.index({ studentId: 1, courseId: 1 }, { unique: true });
enrollmentSchema.index({ createdAt: -1 });

enrollmentSchema.statics.generateTransactionId = function generateTransactionId() {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `TXN-${day}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
};

enrollmentSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = ret._id;
    // Rows created before transaction ids existed still need something to show.
    if (!ret.transactionId) ret.transactionId = `TXN-${String(ret._id).slice(-8).toUpperCase()}`;
    delete ret.__v;
    return ret;
  },
});

const Enrollment = mongoose.model('Enrollment', enrollmentSchema);
Enrollment.STATUSES = STATUSES;

module.exports = Enrollment;
