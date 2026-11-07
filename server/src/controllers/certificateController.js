const Certificate = require('../models/Certificate');
const certificateService = require('../services/certificateService');

/** GET /api/certificates — this student's certificates, newest first. */
async function listMine(req, res, next) {
  try {
    const certificates = await certificateService.listMine(req.user._id);
    res.json(certificates);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/certificates/issue  body: { courseId }
 * Normally unnecessary — completion issues the certificate on its own — but
 * it lets the Certificates page force a check for a specific course.
 */
async function issue(req, res, next) {
  try {
    const { courseId } = req.body || {};
    if (!courseId) return res.status(400).json({ error: 'courseId is required' });

    const certificate = await certificateService.issueForCourse(req.user._id, courseId);
    if (!certificate) {
      return res.status(400).json({ error: 'This course is not complete yet, so no certificate can be issued.' });
    }

    res.json(certificate);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/certificates/sample  body: { recipientName, courseTitle, ... }
 * Staff only: a one-off, unsaved preview of the template with the given details.
 */
async function sample(req, res, next) {
  try {
    const { recipientName, courseTitle, instructor, lessonCount, hours } = req.body || {};

    const name = String(recipientName || '').trim();
    const title = String(courseTitle || '').trim();
    if (!name || !title) {
      return res.status(400).json({ error: 'recipientName and courseTitle are required' });
    }
    if (name.length > 80 || title.length > 120) {
      return res.status(400).json({ error: 'Name or course title is too long' });
    }

    const certificate = certificateService.issueSample({
      recipientName: name,
      courseTitle: title,
      instructor: String(instructor || '').trim().slice(0, 80),
      lessonCount,
      hours,
    });

    res.json(certificate);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/certificates/verify/:serial — public. Returns only what a
 * verifier needs to confirm the certificate is genuine, never the holder's
 * account details.
 */
async function verify(req, res, next) {
  try {
    const certificate = await Certificate.findOne({ serial: req.params.serial });
    if (!certificate) return res.status(404).json({ error: 'No certificate found with that serial' });

    res.json({
      valid: certificate.kind === 'course',
      kind: certificate.kind,
      recipientName: certificate.recipientName,
      courseTitle: certificate.courseTitle,
      instructor: certificate.instructor,
      serial: certificate.serial,
      issuedAt: certificate.issuedAt,
    });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/certificates/:id — only ever used to clear out samples. */
async function remove(req, res, next) {
  try {
    const certificate = await Certificate.findOne({ _id: req.params.id, userId: req.user._id });
    if (!certificate) return res.status(404).json({ error: 'Certificate not found' });
    if (certificate.kind !== 'sample') {
      return res.status(400).json({ error: 'Earned certificates cannot be deleted' });
    }

    await certificate.deleteOne();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { listMine, issue, sample, verify, remove };
