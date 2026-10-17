const Course = require('../models/Course');
const CourseAccess = require('../models/CourseAccess');
const User = require('../models/User');
const settingsService = require('./settingsService');
const { notifyUser, notifyAdmins } = require('./notificationService');

/**
 * The one place course access is granted, and the payment state machine
 * that leads to it. Admin actions, the free-course checkout, the Razorpay
 * callback and its webhook all come through here, so a learner is enrolled
 * (and everyone is told) the same way whichever path got them there.
 */

const rupees = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;

/** True when the grant exists, is switched on and has not run out. */
function isGrantLive(grant) {
  return Boolean(grant?.active) && (!grant.expiresAt || new Date(grant.expiresAt) > new Date());
}

/**
 * Grants (or re-activates) a learner's access to a course.
 *
 * Returns { grant, alreadyActive }. An access that is already live is left
 * untouched — re-running a grant must not quietly extend an expiry date.
 *
 * Options:
 *   by             the staff user granting it (absent for checkout / gateway)
 *   source         'payment' | 'free' | 'manual' | 'bulk'
 *   learnerNotice  { title, message, setting? } — what the learner is told; false for nothing
 *   notifyStaff    tell the admin team "learner enrolled" (default true)
 */
async function grantCourseAccess(studentId, course, { by, source = 'manual', learnerNotice, notifyStaff = true } = {}) {
  const existing = await CourseAccess.findOne({ studentId, courseId: course._id });
  if (isGrantLive(existing)) return { grant: existing, alreadyActive: true };

  const { learning } = await settingsService.get();
  const expiresAt =
    learning.accessDurationDays > 0 ? new Date(Date.now() + learning.accessDurationDays * 86400000) : null;

  const grant = await CourseAccess.findOneAndUpdate(
    { studentId, courseId: course._id },
    {
      $set: { active: true, source, expiresAt, ...(by ? { grantedBy: by } : {}) },
      $setOnInsert: { studentId, courseId: course._id },
    },
    { new: true, upsert: true }
  );

  if (learnerNotice !== false) {
    const notice = learnerNotice || {
      title: 'Course access granted',
      message: `You now have access to "${course.title}". Start learning any time.`,
    };
    await notifyUser(
      studentId,
      {
        type: 'access_granted',
        title: notice.title,
        message: notice.message,
        courseId: course._id,
        link: `/my-courses/${course._id}`,
      },
      { setting: notice.setting }
    );
  }

  if (notifyStaff) {
    const student = await User.findById(studentId).select('name');
    await notifyAdmins(
      {
        type: 'enrollment',
        title: 'Learner enrolled',
        message: `${student?.name || 'A learner'} was enrolled in "${course.title}"${
          source === 'free' ? ' (free course)' : ''
        }.`,
        courseId: course._id,
        link: `/admin/learners/${studentId}`,
      },
      { setting: 'admin.learnerEnrolled', exclude: by }
    );
  }

  return { grant, alreadyActive: false };
}

/** Turns access off. Returns the grant, or null if there was none. */
async function revokeCourseAccess(studentId, course) {
  const grant = await CourseAccess.findOneAndUpdate(
    { studentId, courseId: course._id },
    { active: false },
    { new: true }
  );
  if (!grant) return null;

  await notifyUser(studentId, {
    type: 'access_revoked',
    title: 'Course access revoked',
    message: `Your access to "${course.title}" was revoked`,
    courseId: course._id,
  });
  return grant;
}

async function loadParties(enrollment) {
  const courseId = enrollment.courseId?._id || enrollment.courseId;
  const studentId = enrollment.studentId?._id || enrollment.studentId;
  const [course, student] = await Promise.all([Course.findById(courseId), User.findById(studentId)]);
  return { course, student };
}

/**
 * Marks a payment successful and, per Settings, enrols the learner.
 *
 * An admin confirming by hand always enrols — that is what the button says.
 * A gateway success enrols when "auto-enrol on successful payment" is on;
 * otherwise the admin team is told to enrol the learner themselves.
 *
 * Returns { enrollment, granted }.
 */
async function markPaymentSuccessful(enrollment, { reference = '', by, note = '' } = {}) {
  const { course, student } = await loadParties(enrollment);
  const wasSuccessful = enrollment.status === 'completed';

  if (!wasSuccessful) {
    enrollment.status = 'completed';
    if (reference) enrollment.reference = String(reference).slice(0, 120);
    enrollment.failureReason = '';
    enrollment.confirmedBy = by || undefined;
    enrollment.confirmedAt = new Date();
    enrollment.history.push({ status: 'completed', note: note || (by ? 'Marked paid by admin' : 'Payment verified'), by });
    await enrollment.save();
  }

  if (!course || !student) return { enrollment, granted: false };

  const { payments } = await settingsService.get();
  const shouldEnrol = Boolean(by) || payments.autoEnrolOnSuccess;

  let granted = false;
  if (shouldEnrol) {
    const result = await grantCourseAccess(student._id, course, {
      by,
      source: 'payment',
      learnerNotice: {
        title: 'Payment successful',
        message: `Your payment of ${rupees(enrollment.amount)} is confirmed and "${course.title}" is now unlocked.`,
        setting: 'learner.paymentConfirmed',
      },
      // The "payment received" notice below already says the learner was enrolled.
      notifyStaff: false,
    });
    granted = !result.alreadyActive || wasSuccessful;
  }

  if (!wasSuccessful) {
    await notifyAdmins(
      {
        type: 'payment',
        title: 'Payment received',
        message: `${rupees(enrollment.amount)} from ${student.name} for "${course.title}"${
          shouldEnrol ? ' — learner enrolled.' : ' — enrol the learner from the Payments page.'
        }`,
        courseId: course._id,
        link: '/admin/payments',
      },
      { setting: 'admin.paymentReceived', exclude: by }
    );
  }

  return { enrollment, granted };
}

/** Marks a payment failed and tells the learner how to try again. */
async function markPaymentFailed(enrollment, { reason = '', by } = {}) {
  const { course, student } = await loadParties(enrollment);

  enrollment.status = 'failed';
  enrollment.failureReason = String(reason || '').slice(0, 300);
  enrollment.history.push({ status: 'failed', note: enrollment.failureReason, by });
  await enrollment.save();

  if (!course || !student) return enrollment;

  await notifyUser(student._id, {
    type: 'payment',
    title: 'Payment failed',
    message: `Your payment for "${course.title}" did not go through${
      enrollment.failureReason ? ` (${enrollment.failureReason})` : ''
    }. You can try again from the course page.`,
    courseId: course._id,
    link: `/courses/${course._id}/enrol`,
  });

  await notifyAdmins(
    {
      type: 'payment',
      title: 'Payment failed',
      message: `${student.name}'s payment of ${rupees(enrollment.amount)} for "${course.title}" failed${
        enrollment.failureReason ? `: ${enrollment.failureReason}` : '.'
      }`,
      courseId: course._id,
      link: '/admin/payments',
    },
    { setting: 'admin.paymentFailed', exclude: by }
  );

  return enrollment;
}

module.exports = {
  isGrantLive,
  grantCourseAccess,
  revokeCourseAccess,
  markPaymentSuccessful,
  markPaymentFailed,
  rupees,
};
