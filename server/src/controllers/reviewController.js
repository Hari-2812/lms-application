const mongoose = require('mongoose');
const Course = require('../models/Course');
const Review = require('../models/Review');
const activity = require('../services/activityService');
const { notifyAdmins } = require('../services/notificationService');
const { courseAccessFor } = require('../services/enrolmentService');

/**
 * Course reviews.
 *
 *   Learners   any learner who can open the course leaves one review (a 1–5
 *              star rating and an optional comment) and can edit or delete it.
 *              It shows straight away under the lesson video and on the
 *              course page.
 *   Staff      Admin → Reviews lists every review; staff can hide or unhide
 *              one, correct it (marked "edited by admin") or delete it.
 *
 * The public list shows the reviewer's name only — never their email.
 */

const MAX_COMMENT = 1000;
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function parseRating(value) {
  const rating = Number(value);
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null;
}

/** What the course page shows for one review. */
function publicView(review, viewerId) {
  return {
    id: review._id,
    rating: review.rating,
    comment: review.comment,
    reviewer: review.studentId?.name || 'Former learner',
    editedByAdmin: review.editedByAdmin,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    mine: Boolean(viewerId && String(review.studentId?._id || review.studentId) === String(viewerId)),
  };
}

async function summaryFor(courseId) {
  const rows = await Review.aggregate([
    { $match: { courseId: new mongoose.Types.ObjectId(String(courseId)), hidden: false } },
    { $group: { _id: '$rating', count: { $sum: 1 } } },
  ]);
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let count = 0;
  let total = 0;
  for (const row of rows) {
    distribution[row._id] = row.count;
    count += row.count;
    total += row._id * row.count;
  }
  return { count, average: count ? Math.round((total / count) * 10) / 10 : 0, distribution };
}

/**
 * GET /api/courses/:courseId/reviews — public.
 * Returns { summary, reviews, mine, canReview }.
 */
async function listForCourse(req, res, next) {
  try {
    const { courseId } = req.params;
    if (!mongoose.isValidObjectId(courseId)) return res.status(404).json({ error: 'Course not found' });

    const course = await Course.findById(courseId).select('published');
    if (!course || (course.published === false && req.user?.role !== 'admin')) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const viewerId = req.user?._id;
    const [summary, reviews, mine, access] = await Promise.all([
      summaryFor(courseId),
      Review.find({ courseId, hidden: false }).populate('studentId', 'name').sort({ createdAt: -1 }).limit(100),
      viewerId ? Review.findOne({ courseId, studentId: viewerId }) : null,
      req.user && req.user.role !== 'admin' ? courseAccessFor(req.user, courseId) : { allowed: false },
    ]);

    res.json({
      summary,
      reviews: reviews.map((r) => publicView(r, viewerId)),
      // The learner's own review, including when staff have hidden it.
      mine: mine
        ? { id: mine._id, rating: mine.rating, comment: mine.comment, hidden: mine.hidden, editedByAdmin: mine.editedByAdmin, updatedAt: mine.updatedAt }
        : null,
      canReview: access.allowed,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/courses/:courseId/reviews  body: { rating, comment }
 * Creates the learner's review, or updates it if they already left one.
 * Behind requireCourseAccess.
 */
async function saveMine(req, res, next) {
  try {
    if (req.user.role === 'admin') return res.status(403).json({ error: 'Staff accounts cannot review courses' });

    const rating = parseRating(req.body?.rating);
    if (!rating) return res.status(400).json({ error: 'Choose a rating from 1 to 5 stars.' });
    const comment = String(req.body?.comment ?? '').trim();
    if (comment.length > MAX_COMMENT) {
      return res.status(400).json({ error: `Keep the review under ${MAX_COMMENT} characters.` });
    }

    const { courseId } = req;
    const existing = await Review.findOne({ courseId, studentId: req.user._id });

    let review;
    if (existing) {
      existing.rating = rating;
      existing.comment = comment;
      // The learner's new words are their own again.
      existing.editedByAdmin = false;
      review = await existing.save();
    } else {
      try {
        review = await Review.create({ courseId, studentId: req.user._id, rating, comment });
      } catch (err) {
        // A double-submit raced the first one; the unique index keeps one review.
        if (err.code !== 11000) throw err;
        review = await Review.findOneAndUpdate({ courseId, studentId: req.user._id }, { rating, comment }, { new: true });
      }

      const course = await Course.findById(courseId).select('title');
      await notifyAdmins(
        {
          type: 'review',
          title: 'New course review',
          message: `${req.user.name} rated "${course?.title}" ${rating}/5${comment ? `: "${comment.slice(0, 120)}"` : '.'}`,
          courseId,
          link: '/admin/reviews',
        },
        { setting: 'admin.reviewPosted' }
      );
    }

    res.status(existing ? 200 : 201).json({
      id: review._id,
      rating: review.rating,
      comment: review.comment,
      hidden: review.hidden,
      editedByAdmin: review.editedByAdmin,
      updatedAt: review.updatedAt,
    });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/courses/:courseId/reviews/mine */
async function deleteMine(req, res, next) {
  try {
    const { courseId } = req.params;
    if (!mongoose.isValidObjectId(courseId)) return res.status(404).json({ error: 'Review not found' });
    const review = await Review.findOneAndDelete({ courseId, studentId: req.user._id });
    if (!review) return res.status(404).json({ error: 'Review not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/* ---------------------------------------------------------------- admin */

/**
 * GET /api/admin/reviews?courseId=&rating=&status=visible|hidden&search=
 * Returns { summary, reviews } with reviewer contact details for staff.
 */
async function listAll(req, res, next) {
  try {
    const { courseId, rating, status, search } = req.query;
    const filter = {};
    if (courseId && mongoose.isValidObjectId(courseId)) filter.courseId = courseId;
    if (parseRating(rating)) filter.rating = parseRating(rating);
    if (status === 'visible') filter.hidden = false;
    else if (status === 'hidden') filter.hidden = true;
    if (search) {
      const pattern = new RegExp(escapeRegex(String(search).trim()), 'i');
      const User = mongoose.model('User');
      const users = await User.find({ $or: [{ name: pattern }, { email: pattern }] }).select('_id');
      filter.$or = [{ comment: pattern }, { studentId: { $in: users.map((u) => u._id) } }];
    }

    const reviews = await Review.find(filter)
      .populate('studentId', 'name email')
      .populate('courseId', 'title')
      .sort({ createdAt: -1 })
      .limit(500);

    const visible = reviews.filter((r) => !r.hidden);
    res.json({
      summary: {
        total: reviews.length,
        hidden: reviews.length - visible.length,
        average: visible.length
          ? Math.round((visible.reduce((sum, r) => sum + r.rating, 0) / visible.length) * 10) / 10
          : 0,
        lowRatings: visible.filter((r) => r.rating <= 2).length,
      },
      reviews,
    });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/admin/reviews/:id  body: { hidden?, rating?, comment? } */
async function moderate(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Review not found' });
    const review = await Review.findById(req.params.id).populate('studentId', 'name email').populate('courseId', 'title');
    if (!review) return res.status(404).json({ error: 'Review not found' });

    const { hidden, rating, comment } = req.body || {};
    const changes = [];

    if (hidden !== undefined && Boolean(hidden) !== review.hidden) {
      review.hidden = Boolean(hidden);
      changes.push(review.hidden ? 'hid' : 'unhid');
    }
    if (rating !== undefined) {
      const parsed = parseRating(rating);
      if (!parsed) return res.status(400).json({ error: 'Rating must be a whole number from 1 to 5.' });
      if (parsed !== review.rating) {
        review.rating = parsed;
        review.editedByAdmin = true;
        changes.push(`changed the rating to ${parsed}/5`);
      }
    }
    if (comment !== undefined) {
      const text = String(comment).trim();
      if (text.length > MAX_COMMENT) return res.status(400).json({ error: `Keep the review under ${MAX_COMMENT} characters.` });
      if (text !== review.comment) {
        review.comment = text;
        review.editedByAdmin = true;
        changes.push('edited the wording');
      }
    }

    if (!changes.length) return res.json(review);

    review.moderatedBy = req.user._id;
    review.moderatedAt = new Date();
    await review.save();

    await activity.log(req, {
      category: 'course',
      action: 'review.moderated',
      summary: `Review by ${review.studentId?.name || 'a learner'} on "${review.courseId?.title}": ${changes.join(', ')}`,
      entityType: 'review',
      entityId: review._id,
    });

    res.json(review);
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/admin/reviews/:id */
async function remove(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Review not found' });
    const review = await Review.findByIdAndDelete(req.params.id).populate('studentId', 'name').populate('courseId', 'title');
    if (!review) return res.status(404).json({ error: 'Review not found' });

    await activity.log(req, {
      category: 'course',
      action: 'review.deleted',
      summary: `Deleted ${review.studentId?.name || 'a learner'}'s ${review.rating}/5 review of "${review.courseId?.title}"`,
      entityType: 'review',
      entityId: review._id,
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { listForCourse, saveMine, deleteMine, listAll, moderate, remove };
