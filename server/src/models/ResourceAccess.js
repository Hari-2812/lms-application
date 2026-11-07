const mongoose = require('mongoose');

/**
 * Limited Access to learning materials: one study resource shared with one
 * learner, without giving them the rest of the course (its videos and other
 * materials). A learner with course access or Full Access already sees every
 * resource and needs no rows here.
 */
const resourceAccessSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    resourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource', required: true, index: true },
    // Denormalised so "which materials of course X does this learner have" is one query.
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

resourceAccessSchema.index({ studentId: 1, resourceId: 1 }, { unique: true });

module.exports = mongoose.model('ResourceAccess', resourceAccessSchema);
