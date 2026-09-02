const mongoose = require('mongoose');

/**
 * IMPORTANT (security model):
 * We store ONLY the Google Drive file id. We never store or return
 * webContentLink / webViewLink / any drive.google.com URL.
 */
const lessonSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    date: { type: String },
    driveFileId: { type: String, required: true },
    driveFileName: { type: String },
    driveWebViewLink: { type: String },
    mimeType: { type: String },
    duration: { type: Number, default: 0 }, // seconds
    order: { type: Number, required: true },
    folderId: { type: String },
    folderName: { type: String },
  },
  { timestamps: true }
);

lessonSchema.index({ courseId: 1, order: 1 });
lessonSchema.index({ courseId: 1, driveFileId: 1 }, { unique: true });

// Never leak the Drive file id to the client.
lessonSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.driveFileId;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Lesson', lessonSchema);
