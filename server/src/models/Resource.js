const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    // A shareable link (Google Drive "anyone with the link", a hosted PDF, etc).
    // Study materials are lower-sensitivity than paid video, so unlike lessons
    // this is served as a direct link rather than proxied through our API.
    url: { type: String, required: true },
    type: { type: String, enum: ['pdf', 'doc', 'slides', 'link'], default: 'pdf' },
  },
  { timestamps: true }
);

resourceSchema.index({ courseId: 1, createdAt: 1 });

resourceSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Resource', resourceSchema);
