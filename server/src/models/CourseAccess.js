const mongoose = require('mongoose');

const courseAccessSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    active: { type: Boolean, default: true },
    grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // How the access came about: 'payment', 'free', 'manual' (admin) or 'bulk'.
    source: { type: String, default: 'manual' },
    // Set when Settings limits access to N days; absent means lifetime access.
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

courseAccessSchema.index({ studentId: 1, courseId: 1 }, { unique: true });

module.exports = mongoose.model('CourseAccess', courseAccessSchema);
