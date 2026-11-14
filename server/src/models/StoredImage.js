const mongoose = require('mongoose');

/**
 * An admin-uploaded image (course thumbnail, homepage / sign-in picture),
 * kept in MongoDB rather than on the server's disk.
 *
 * Hosts like Render give the API an ephemeral filesystem: every deploy,
 * restart or free-tier spin-down wipes it, so images written to disk vanished
 * while courses still pointed at them. The database is the one store that
 * survives, and uploads are capped at 5 MB — well inside a document's 16 MB.
 *
 * Served at /uploads/thumbnails/:filename (see uploadController.serveImage),
 * the same path disk uploads always used, so stored links keep working.
 */
const storedImageSchema = new mongoose.Schema(
  {
    // Generated server-side, e.g. "1794548442433-02c63d2f1de66b89.png".
    filename: { type: String, required: true, unique: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true },
    // Strong validator for conditional requests (If-None-Match → 304).
    etag: { type: String, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StoredImage', storedImageSchema);
