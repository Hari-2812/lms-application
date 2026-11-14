const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

/**
 * Admin image uploads (course thumbnails, homepage / sign-in pictures).
 *
 * WHERE THE FILES GO
 * Into MongoDB (models/StoredImage), served at /uploads/thumbnails/:filename.
 * They used to be written to server/uploads/thumbnails, but the API runs on
 * Render, whose filesystem is wiped on every deploy, restart and free-tier
 * spin-down — uploaded thumbnails disappeared while the courses still
 * pointed at them. The database is the store that survives.
 *
 * Files already on disk (local development, or a persistent volume mounted
 * at UPLOAD_DIR) are still served from there first; see index.js.
 */

const UPLOAD_ROOT = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '../../uploads');

const THUMBNAIL_DIR = path.join(UPLOAD_ROOT, 'thumbnails');

try {
  fs.mkdirSync(THUMBNAIL_DIR, { recursive: true });
} catch {
  // A read-only filesystem is fine now that uploads live in the database.
}

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

/**
 * The image type the bytes actually are, from their file signature, or null.
 *
 * The browser's Content-Type is only a guess from the file extension — an
 * iPhone HEIC photo renamed to .jpg arrives as image/jpeg and then shows as a
 * broken image everywhere. Checking the signature rejects it at upload time.
 */
function sniffImageType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  const head = buffer.subarray(0, 6).toString('ascii');
  if (head === 'GIF87a' || head === 'GIF89a') return 'image/gif';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

/**
 * The stored name is generated, never derived from what the browser sent.
 * An attacker-supplied name like "../../src/index.js" or "evil.html" would
 * otherwise decide where the bytes land and how they are served back.
 */
function generateFilename(contentType) {
  const extension = ALLOWED.get(contentType) || '.bin';
  return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`;
}

/** Names this server generates — anything else is not one of our uploads. */
const STORED_NAME = /^\d{10,16}-[a-f0-9]{16}\.(jpg|png|webp|gif)$/;

const uploadImage = multer({
  // Held in memory just long enough to be saved to the database.
  storage: multer.memoryStorage(),
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

module.exports = {
  uploadThumbnail,
  UPLOAD_ROOT,
  THUMBNAIL_DIR,
  resolveStoredThumbnail,
  sniffImageType,
  generateFilename,
  STORED_NAME,
};
