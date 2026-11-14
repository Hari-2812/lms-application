const crypto = require('crypto');
const fs = require('fs');
const StoredImage = require('../models/StoredImage');
const { resolveStoredThumbnail, sniffImageType, generateFilename, STORED_NAME } = require('../middleware/upload');

/**
 * POST /api/admin/uploads/image   (multipart, field name "file")
 *
 * Saves the image in MongoDB and returns the path it is served at. Stored on
 * the course as `thumbnail`, so it is a site-relative path rather than an
 * absolute URL — that keeps it correct if the API later moves to a different
 * host.
 */
async function uploadImage(req, res, next) {
  try {
    if (!req.file?.buffer?.length) {
      return res.status(400).json({ error: 'No image was uploaded.' });
    }

    // Trust the bytes, not the browser's guess from the file extension.
    const contentType = sniffImageType(req.file.buffer);
    if (!contentType) {
      return res.status(400).json({
        error: 'That file is not a valid JPG, PNG, WebP or GIF image. (iPhone HEIC photos need converting to JPG first.)',
      });
    }

    const filename = generateFilename(contentType);
    await StoredImage.create({
      filename,
      contentType,
      size: req.file.size,
      data: req.file.buffer,
      etag: `"${crypto.createHash('sha1').update(req.file.buffer).digest('hex')}"`,
      uploadedBy: req.user?._id,
    });

    res.status(201).json({
      url: `/uploads/thumbnails/${filename}`,
      filename,
      size: req.file.size,
      mimeType: contentType,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /uploads/thumbnails/:filename
 *
 * Serves an uploaded image from the database. Mounted after the static disk
 * handler in index.js, so a file that still exists on disk is served from
 * there and everything else falls through to here.
 *
 * Public, like the catalogue it appears on. Filenames are random and never
 * reused, so responses can be cached for a long time.
 */
async function serveImage(req, res, next) {
  try {
    const { filename } = req.params;
    if (!STORED_NAME.test(filename)) return res.status(404).json({ error: 'Image not found' });

    // Not lean(): a hydrated document hands `data` back as a real Buffer.
    const image = await StoredImage.findOne({ filename });
    if (!image) return res.status(404).json({ error: 'Image not found' });

    res.set({
      'Content-Type': image.contentType,
      'Cache-Control': 'public, max-age=2592000, immutable',
      ETag: image.etag,
      'Last-Modified': new Date(image.createdAt).toUTCString(),
      'X-Content-Type-Options': 'nosniff',
      // Same lock-down as the disk handler: never run anything in our origin.
      'Content-Security-Policy': "default-src 'none'; img-src 'self'",
      // The frontend is a different origin; say explicitly it may embed this.
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });

    if (req.get('if-none-match') === image.etag) return res.status(304).end();

    const body = image.data;
    res.set('Content-Length', String(body.length));
    res.status(200).end(req.method === 'HEAD' ? undefined : body);
  } catch (err) {
    next(err);
  }
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

    const { deletedCount } = await StoredImage.deleteOne({ filename: req.params.filename });

    // Uploads made before images moved to the database live on disk.
    let removedFromDisk = false;
    if (fs.existsSync(target)) {
      await fs.promises.unlink(target);
      removedFromDisk = true;
    }

    // Already gone is the desired end state, so treat it as success.
    res.json({ success: true, alreadyAbsent: !deletedCount && !removedFromDisk });
  } catch (err) {
    next(err);
  }
}

module.exports = { uploadImage, serveImage, deleteImage };
