const Course = require('../models/Course');
const CourseAccess = require('../models/CourseAccess');
const Enrollment = require('../models/Enrollment');
const { notifyUser, notifyAdmins } = require('../services/notificationService');

const METHODS = new Set(['free', 'upi', 'card', 'netbanking', 'bank-transfer']);

/**
 * Enrolment / checkout.
 *
 * No payment gateway is integrated. A free course is granted on the spot; a
 * paid course records a `pending` enrolment and notifies the admin team, and
 * confirming it from the admin dashboard is what creates the access grant.
 * Dropping a real provider in later means setting `reference` and calling the
 * same confirm path from its webhook.
 */

/** POST /api/enrollments  body: { courseId, method? } */
async function enrol(req, res, next) {
  try {
    const { courseId, method } = req.body || {};
    if (!courseId) return res.status(400).json({ error: 'courseId is required' });

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (course.published === false) {
      return res.status(400).json({ error: 'This course is not open for enrolment yet' });
    }

    const studentId = req.user._id;

    // Already has access — nothing to pay for, nothing to queue.
    const existingAccess = await CourseAccess.findOne({ studentId, courseId, active: true });
    if (existingAccess) {
      return res.status(200).json({
        status: 'completed',
        alreadyEnrolled: true,
        message: 'You already have access to this course.',
      });
    }

    // Price is read from the course, never from the request body.
    const amount = Number(course.price) || 0;
    const isFree = amount <= 0;
    const resolvedMethod = isFree ? 'free' : METHODS.has(method) ? method : 'upi';

    const enrollment = await Enrollment.findOneAndUpdate(
      { studentId, courseId },
      {
        studentId,
        courseId,
        amount,
        currency: 'INR',
        method: resolvedMethod,
        status: isFree ? 'completed' : 'pending',
        ...(isFree ? { confirmedAt: new Date() } : {}),
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (isFree) {
      await CourseAccess.findOneAndUpdate(
        { studentId, courseId },
        { studentId, courseId, active: true },
        { upsert: true }
      );

      await notifyUser(studentId, {
        type: 'access_granted',
        title: 'You are enrolled',
        message: `You now have access to "${course.title}". Start learning any time.`,
        courseId: course._id,
        link: `/my-courses/${course._id}`,
      });

      return res.status(201).json({ ...enrollment.toJSON(), granted: true });
    }

    await notifyUser(studentId, {
      type: 'payment',
      title: 'Enrolment received',
      message: `We have your enrolment for "${course.title}". Access opens as soon as your payment is confirmed.`,
      courseId: course._id,
      link: '/my-courses',
    });

    await notifyAdmins({
      type: 'payment',
      title: 'Payment awaiting confirmation',
      message: `${req.user.name} enrolled in "${course.title}" (₹${amount.toLocaleString('en-IN')}).`,
      courseId: course._id,
      link: '/admin',
    });

    res.status(201).json({ ...enrollment.toJSON(), granted: false });
  } catch (err) {
    next(err);
  }
}

/** GET /api/enrollments/mine */
async function listMine(req, res, next) {
  try {
    const enrollments = await Enrollment.find({ studentId: req.user._id })
      .populate('courseId', 'title slug thumbnail price')
      .sort({ createdAt: -1 });
    res.json(enrollments);
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/enrollments?status=pending */
async function listAll(req, res, next) {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    const enrollments = await Enrollment.find(filter)
      .populate('studentId', 'name email')
      .populate('courseId', 'title price')
      .sort({ createdAt: -1 })
      .limit(200);

    res.json(enrollments);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/enrollments/:id/confirm  body: { reference? }
 * Marks the payment received and grants course access in one step.
 */
async function confirm(req, res, next) {
  try {
    const enrollment = await Enrollment.findById(req.params.id).populate('courseId', 'title');
    if (!enrollment) return res.status(404).json({ error: 'Enrolment not found' });
    if (enrollment.status === 'completed') {
      return res.status(400).json({ error: 'This enrolment is already confirmed' });
    }

    enrollment.status = 'completed';
    enrollment.reference = String(req.body?.reference || '').slice(0, 120);
    enrollment.confirmedBy = req.user._id;
    enrollment.confirmedAt = new Date();
    await enrollment.save();

    await CourseAccess.findOneAndUpdate(
      { studentId: enrollment.studentId, courseId: enrollment.courseId },
      { studentId: enrollment.studentId, courseId: enrollment.courseId, active: true, grantedBy: req.user._id },
      { upsert: true }
    );

    await notifyUser(enrollment.studentId, {
      type: 'access_granted',
      title: 'Payment confirmed',
      message: `Your payment is confirmed and "${enrollment.courseId?.title}" is now unlocked.`,
      courseId: enrollment.courseId?._id || enrollment.courseId,
      link: `/my-courses/${enrollment.courseId?._id || enrollment.courseId}`,
    });

    res.json(enrollment);
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/enrollments/:id/cancel */
async function cancel(req, res, next) {
  try {
    const enrollment = await Enrollment.findById(req.params.id).populate('courseId', 'title');
    if (!enrollment) return res.status(404).json({ error: 'Enrolment not found' });

    enrollment.status = 'cancelled';
    await enrollment.save();

    await notifyUser(enrollment.studentId, {
      type: 'payment',
      title: 'Enrolment cancelled',
      message: `Your enrolment for "${enrollment.courseId?.title}" was cancelled. Get in touch if this looks wrong.`,
      courseId: enrollment.courseId?._id || enrollment.courseId,
      link: '/my-courses',
    });

    res.json(enrollment);
  } catch (err) {
    next(err);
  }
}

module.exports = { enrol, listMine, listAll, confirm, cancel };
