const Submission = require('../models/Submission');
const { notifyUser, notifyAdmins } = require('../services/notificationService');

/**
 * Task submissions.
 *
 * Work arrives as a Google Drive link rather than an upload. A link is only
 * useful to a reviewer if it actually opens, so the host is validated here
 * and the UI tells the student to set "Anyone with the link – Viewer".
 *
 * We deliberately do NOT try to verify the sharing setting server-side: the
 * service account cannot see a file it has not been shared with, so a
 * permission check would reject perfectly good links owned by students
 * outside the organisation. The reviewer finds out on opening it, and can
 * send it back with `needs_revision`.
 */

/** Drive, Docs, Sheets, Slides and Colab all count as Drive links. */
const DRIVE_HOSTS = /^(drive|docs|colab\.research)\.google\.com$/i;

function validateDriveLink(raw) {
  const value = String(raw || '').trim();
  if (!value) return { error: 'A Google Drive link is required.' };

  let url;
  try {
    url = new URL(value);
  } catch {
    return { error: 'That does not look like a link. Paste the full https:// URL.' };
  }

  if (url.protocol !== 'https:') {
    return { error: 'The link must start with https://' };
  }
  if (!DRIVE_HOSTS.test(url.hostname.replace(/^www\./, ''))) {
    return {
      error: 'Use a Google Drive link (drive.google.com, docs.google.com or colab.research.google.com).',
    };
  }

  return { value: url.href };
}

/** POST /api/submissions */
async function createSubmission(req, res, next) {
  try {
    const { category, title, description, driveLink, courseId } = req.body || {};

    if (!Submission.CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'Choose a category from the list.' });
    }

    const trimmedDescription = String(description || '').trim();
    if (!trimmedDescription) {
      return res.status(400).json({ error: 'Add a short description of what you are submitting.' });
    }
    if (trimmedDescription.length > 2000) {
      return res.status(400).json({ error: 'Keep the description under 2000 characters.' });
    }

    const link = validateDriveLink(driveLink);
    if (link.error) return res.status(400).json({ error: link.error });

    const submission = await Submission.create({
      studentId: req.user._id,
      category,
      title: String(title || '').trim().slice(0, 160),
      description: trimmedDescription,
      driveLink: link.value,
      courseId: courseId || undefined,
    });

    await notifyAdmins({
      type: 'task',
      title: 'New task submission',
      message: `${req.user.name} submitted ${category}${submission.title ? `: ${submission.title}` : ''}.`,
      link: '/admin',
    });

    res.status(201).json(submission);
  } catch (err) {
    next(err);
  }
}

/** GET /api/submissions/mine */
async function listMine(req, res, next) {
  try {
    const submissions = await Submission.find({ studentId: req.user._id })
      .populate('courseId', 'title')
      .sort({ createdAt: -1 });
    res.json(submissions);
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/submissions/:id — a student may withdraw work not yet reviewed. */
async function withdraw(req, res, next) {
  try {
    const submission = await Submission.findOne({
      _id: req.params.id,
      studentId: req.user._id,
    });
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    if (submission.status !== 'submitted') {
      return res
        .status(400)
        .json({ error: 'This has already been picked up for review and cannot be withdrawn.' });
    }

    await submission.deleteOne();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/** The categories the form offers — served so the client cannot drift from it. */
async function listCategories(_req, res) {
  res.json({ categories: Submission.CATEGORIES, statuses: Submission.STATUSES });
}

/* ---------------------------------------------------------------- admin */

/** GET /api/admin/submissions?status=&category= */
async function listAll(req, res, next) {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;

    const submissions = await Submission.find(filter)
      .populate('studentId', 'name email')
      .populate('courseId', 'title')
      .sort({ createdAt: -1 })
      .limit(300);

    res.json(submissions);
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/admin/submissions/:id  body: { status, feedback } */
async function review(req, res, next) {
  try {
    const { status, feedback } = req.body || {};

    if (status !== undefined && !Submission.STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Unknown review status.' });
    }

    const submission = await Submission.findById(req.params.id);
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    const previousStatus = submission.status;

    if (status !== undefined) submission.status = status;
    if (feedback !== undefined) submission.feedback = String(feedback).trim().slice(0, 2000);
    submission.reviewedBy = req.user._id;
    submission.reviewedAt = new Date();
    await submission.save();

    // Only tell the student when the outcome actually changed — saving a
    // note to yourself should not ping them.
    if (status !== undefined && status !== previousStatus) {
      const wording = {
        under_review: 'is being reviewed',
        accepted: 'was accepted',
        needs_revision: 'needs another look',
        submitted: 'was reopened',
      }[status];

      await notifyUser(submission.studentId, {
        type: 'task',
        title: 'Task review update',
        message:
          `Your ${submission.category} submission ${wording}.` +
          (submission.feedback ? ` Feedback: ${submission.feedback.slice(0, 120)}` : ''),
        link: '/tasks',
      });
    }

    res.json(submission);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createSubmission,
  listMine,
  withdraw,
  listCategories,
  listAll,
  review,
};
