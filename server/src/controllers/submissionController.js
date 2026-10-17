const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const activity = require('../services/activityService');
const certificateService = require('../services/certificateService');
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
    const { category, title, description, driveLink, assignmentId } = req.body || {};
    let { courseId } = req.body || {};

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

    // Work handed in against an assignment belongs to that assignment's course.
    let assignment = null;
    if (assignmentId) {
      assignment = await Assignment.findOne({ _id: assignmentId, published: true });
      if (!assignment) return res.status(400).json({ error: 'That assignment is no longer open.' });
      if (assignment.courseId) courseId = assignment.courseId;
    }

    const submission = await Submission.create({
      studentId: req.user._id,
      category,
      title: String(title || '').trim().slice(0, 160),
      description: trimmedDescription,
      driveLink: link.value,
      courseId: courseId || undefined,
      assignmentId: assignment?._id,
    });

    const what = assignment ? `"${assignment.title}"` : category;
    await notifyAdmins(
      {
        type: 'submission',
        title: 'Task submitted — awaiting review',
        message: `${req.user.name} submitted ${what}${submission.title ? `: ${submission.title}` : ''}.`,
        link: '/admin/tasks',
      },
      { setting: 'admin.taskSubmitted' }
    );

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
      .populate('assignmentId', 'title maxScore dueDate')
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
    if (req.query.assignmentId) filter.assignmentId = req.query.assignmentId;

    const submissions = await Submission.find(filter)
      .populate('studentId', 'name email')
      .populate('courseId', 'title')
      .populate('assignmentId', 'title maxScore dueDate')
      .sort({ createdAt: -1 })
      .limit(300);

    res.json(submissions);
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/admin/submissions/:id  body: { status, feedback, score } */
async function review(req, res, next) {
  try {
    const { status, feedback, score } = req.body || {};

    if (status !== undefined && !Submission.STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Unknown review status.' });
    }

    const submission = await Submission.findById(req.params.id).populate('assignmentId', 'title maxScore');
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    // undefined = leave the score alone, null = clear it.
    const maxScore = submission.assignmentId?.maxScore || 100;
    let resolvedScore;
    if (score === null || score === '') resolvedScore = null;
    else if (score !== undefined) {
      resolvedScore = Number(score);
      if (!Number.isFinite(resolvedScore) || resolvedScore < 0 || resolvedScore > maxScore) {
        return res.status(400).json({ error: `Score must be between 0 and ${maxScore}.` });
      }
    }

    const previousStatus = submission.status;
    const previousScore = submission.score;

    if (status !== undefined) submission.status = status;
    if (feedback !== undefined) submission.feedback = String(feedback).trim().slice(0, 2000);
    if (resolvedScore !== undefined) submission.score = resolvedScore;
    submission.reviewedBy = req.user._id;
    submission.reviewedAt = new Date();
    await submission.save();

    const hasScore = submission.score !== null && submission.score !== undefined;
    const statusChanged = status !== undefined && status !== previousStatus;
    const scoreChanged = resolvedScore !== undefined && resolvedScore !== previousScore;

    // Only tell the student when the outcome actually changed — saving a
    // note to yourself should not ping them.
    if (statusChanged || (scoreChanged && submission.status !== 'submitted')) {
      const wording = {
        under_review: 'is being reviewed',
        accepted: 'was accepted',
        needs_revision: 'needs another look',
        submitted: 'was reopened',
      }[submission.status];
      const what = submission.assignmentId
        ? `"${submission.assignmentId.title}"`
        : `${submission.category} submission`;
      const reviewed = ['accepted', 'needs_revision'].includes(submission.status);

      await notifyUser(
        submission.studentId,
        {
          type: 'task_review',
          title: reviewed ? 'Task reviewed — feedback ready' : 'Task review update',
          message:
            `Your ${what} ${wording}.` +
            (hasScore ? ` Score: ${submission.score}/${maxScore}.` : '') +
            (submission.feedback ? ` Feedback: ${submission.feedback.slice(0, 120)}` : ''),
          link: '/tasks',
        },
        // "Being reviewed" is a courtesy; the Settings switch covers the result itself.
        { setting: reviewed ? 'learner.taskReviewed' : undefined }
      );
    }

    // An accepted task may be the last thing standing between the learner
    // and a certificate, when Settings requires one.
    if (statusChanged && submission.status === 'accepted' && submission.courseId) {
      await certificateService
        .issueForCourse(submission.studentId, submission.courseId)
        .catch((err) => console.error('[review] certificate issue failed:', err.message));
    }

    if (statusChanged || scoreChanged) {
      await activity.log(req, {
        category: 'task',
        action: 'task.reviewed',
        summary: `Reviewed a submission: ${submission.status.replace('_', ' ')}${
          hasScore ? `, score ${submission.score}/${maxScore}` : ''
        }`,
        entityType: 'submission',
        entityId: submission._id,
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
