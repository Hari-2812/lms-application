const Course = require('../models/Course');
const CourseAccess = require('../models/CourseAccess');
const Enrollment = require('../models/Enrollment');
const settingsService = require('../services/settingsService');
const { notifyUser, notifyAdmins } = require('../services/notificationService');
const { grantCourseAccess, isGrantLive, rupees } = require('../services/enrolmentService');

const METHODS = new Set(['free', 'upi', 'card', 'netbanking', 'bank-transfer']);

/**
 * Enrolment / checkout for the manual payment path.
 *
 * A free course is granted on the spot (unless Settings turns free
 * self-enrolment off). A paid course records a `pending` transaction and
 * notifies the admin team; marking it paid from Admin → Payments is what
 * enrols the learner. Online card/UPI payment goes through Razorpay instead —
 * see paymentController.createRazorpayOrder.
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
    const existingAccess = await CourseAccess.findOne({ studentId, courseId });
    if (isGrantLive(existingAccess)) {
      return res.status(200).json({
        status: 'completed',
        alreadyEnrolled: true,
        message: 'You already have access to this course.',
      });
    }

    const { learning } = await settingsService.get();

    // Price is read from the course, never from the request body.
    const amount = Number(course.price) || 0;
    const isFree = amount <= 0;
    const grantNow = isFree && learning.freeCourseSelfEnrol;
    const resolvedMethod = isFree ? 'free' : METHODS.has(method) ? method : 'upi';

    let enrollment = await Enrollment.findOne({ studentId, courseId });
    const status = grantNow ? 'completed' : 'pending';
    const note = isFree ? (grantNow ? 'Free enrolment' : 'Free enrolment awaiting approval') : `Checkout by ${resolvedMethod}`;

    if (!enrollment) {
      enrollment = new Enrollment({
        studentId,
        courseId,
        transactionId: Enrollment.generateTransactionId(),
        history: [],
      });
    } else {
      // Re-enrolling after a failure or cancellation reuses the row and its history.
      enrollment.attempts = (enrollment.attempts || 1) + 1;
      if (!enrollment.transactionId) enrollment.transactionId = Enrollment.generateTransactionId();
    }
    Object.assign(enrollment, {
      amount,
      currency: 'INR',
      method: resolvedMethod,
      gateway: 'manual',
      status,
      failureReason: '',
      ...(grantNow ? { confirmedAt: new Date() } : {}),
    });
    enrollment.history.push({ status, note });
    await enrollment.save();

    if (grantNow) {
      await grantCourseAccess(studentId, course, {
        source: 'free',
        learnerNotice: {
          title: 'You are enrolled',
          message: `You now have access to "${course.title}". Start learning any time.`,
        },
      });
      return res.status(201).json({ ...enrollment.toJSON(), granted: true });
    }

    await notifyUser(studentId, {
      type: 'payment',
      title: isFree ? 'Enrolment received' : 'Payment pending',
      message: isFree
        ? `We have your enrolment for "${course.title}". Access opens once it is approved.`
        : `We have your enrolment for "${course.title}" (${rupees(amount)}). Access opens as soon as your payment is confirmed.`,
      courseId: course._id,
      link: '/my-courses',
    });

    await notifyAdmins(
      {
        type: 'payment',
        title: isFree ? 'Enrolment awaiting approval' : 'Payment pending',
        message: `${req.user.name} enrolled in "${course.title}"${isFree ? '' : ` (${rupees(amount)} by ${resolvedMethod})`}.`,
        courseId: course._id,
        link: '/admin/payments',
      },
      { setting: 'admin.paymentPending' }
    );

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

/** GET /api/admin/enrollments?status=pending — used by the notification composer. */
async function listAll(req, res, next) {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    const enrollments = await Enrollment.find(filter)
      .populate('studentId', 'name email')
      .populate('courseId', 'title price')
      .sort({ createdAt: -1 })
      .limit(500);

    res.json(enrollments);
  } catch (err) {
    next(err);
  }
}

module.exports = { enrol, listMine, listAll };
