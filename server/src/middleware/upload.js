const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

/**
 * Admin image uploads (course thumbnails), stored on the server's disk.
 *
 * WHERE THE FILES GO
 * server/uploads/thumbnails, served read-only at /uploads/... by index.js.
 * The directory is gitignored.
 *
 * DEPLOYMENT CAVEAT
 * This is local disk. Hosts that give you an ephemeral filesystem
 * (Render, Railway, Fly, Heroku, a Vercel serverless function) wipe it on
 * every deploy and restart, so uploaded thumbnails disappear while the
 * database still points at them. To keep them, attach a persistent volume
 * and point UPLOAD_DIR at it, or move to object storage (S3/Cloudinary).
 */

const UPLOAD_ROOT = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '../../uploads');

const THUMBNAIL_DIR = path.join(UPLOAD_ROOT, 'thumbnails');

fs.mkdirSync(THUMBNAIL_DIR, { recursive: true });

/**
 * Raster images only.
 *
 * SVG is deliberately excluded: an SVG is an XML document that can carry
 * <script>, so serving an uploaded one from our own origin would be stored
 * XSS against every admin and student who views the catalogue.
 */
const ALLOWED = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, THUMBNAIL_DIR),

  /**
   * The stored name is generated, never derived from what the browser sent.
   * An attacker-supplied name like "../../src/index.js" or "evil.html" would
   * otherwise decide where the bytes land and how they are served back.
   */
  filename: (_req, file, cb) => {
    const extension = ALLOWED.get(file.mimetype) || '.bin';
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`);
  },
});

const uploadImage = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      const err = new Error('Only JPG, PNG, WebP or GIF images are allowed.');
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  },
}).single('file');

/**
 * Wraps multer so its own errors come back as clean JSON instead of being
 * thrown as 500s by the generic error handler.
 */
function uploadThumbnail(req, res, next) {
  uploadImage(req, res, (err) => {
    if (!err) return next();

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'That image is larger than 5 MB.' });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Send the image as a single "file" field.' });
    }
    return res.status(err.status || 400).json({ error: err.message || 'Upload failed.' });
  });
}

/** Absolute path of a stored thumbnail, or null if the name escapes the dir. */
function resolveStoredThumbnail(filename) {
  const resolved = path.resolve(THUMBNAIL_DIR, filename);
  // path.resolve collapses "..", so this catches traversal attempts.
  if (resolved !== path.join(THUMBNAIL_DIR, path.basename(filename))) return null;
  return resolved;
}

module.exports = { uploadThumbnail, UPLOAD_ROOT, THUMBNAIL_DIR, resolveStoredThumbnail };
