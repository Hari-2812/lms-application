const fs = require('fs');
const { resolveStoredThumbnail } = require('../middleware/upload');

/**
 * POST /api/admin/uploads/image   (multipart, field name "file")
 *
 * Returns the path the image is served at. Stored on the course as
 * `thumbnail`, so it is a site-relative path rather than an absolute URL —
 * that keeps it correct if the API later moves to a different host.
 */
async function uploadImage(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No image was uploaded.' });
  }

  res.status(201).json({
    url: `/uploads/thumbnails/${req.file.filename}`,
    filename: req.file.filename,
    size: req.file.size,
    mimeType: req.file.mimetype,
  });
}

/**
 * DELETE /api/admin/uploads/thumbnails/:filename
 *
 * Housekeeping for a replaced thumbnail. Deliberately does not check whether
 * a course still references the file — the admin UI only calls this for an
 * image it just replaced.
 */
async function deleteImage(req, res, next) {
  try {
    const target = resolveStoredThumbnail(req.params.filename);
    if (!target) return res.status(400).json({ error: 'Invalid filename.' });

    if (!fs.existsSync(target)) {
      // Already gone is the desired end state, so treat it as success.
      return res.json({ success: true, alreadyAbsent: true });
    }

    await fs.promises.unlink(target);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { uploadImage, deleteImage };
