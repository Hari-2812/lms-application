const mongoose = require('mongoose');

/**
 * IMPORTANT (security model):
 * We store ONLY the Google Drive file id. We never store or return
 * webContentLink / webViewLink / any drive.google.com URL.
 */
const lessonSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    videoFileId: { type: String, required: true },
    order: { type: Number, required: true },
    duration: { type: Number, default: 0 }, // seconds
  },
  { timestamps: true }
);

lessonSchema.index({ courseId: 1, order: 1 });

// Never leak the Drive file id to the client.
lessonSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.videoFileId;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Lesson', lessonSchema);
