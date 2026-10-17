const mongoose = require('mongoose');

/**
 * A task the admin sets for learners, with a due date. Learners hand work in
 * against it from the Task Submission page (Submission.assignmentId), and
 * publishing one notifies the learners it is for.
 */
const assignmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },

    // Optional: tie it to one course's learners. Absent means everyone.
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', index: true },

    dueDate: { type: Date },
    maxScore: { type: Number, default: 100, min: 1 },

    published: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

assignmentSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Assignment', assignmentSchema);
