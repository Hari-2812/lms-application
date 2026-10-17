const ActivityLog = require('../models/ActivityLog');
const Certificate = require('../models/Certificate');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Submission = require('../models/Submission');
const User = require('../models/User');

/**
 * Read-only admin views: the overview dashboard, the activity log and the
 * issued-certificates register.
 */

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** GET /api/admin/overview — the numbers on the admin home page. */
async function getOverview(req, res, next) {
  try {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const learnerFilter = { role: { $ne: 'admin' } };

    const [
      learners,
      newLearners,
      suspended,
      courses,
      publishedCourses,
      paymentTotals,
      monthRevenue,
      awaitingReview,
      certificates,
      recentPayments,
      recentLearners,
      recentActivity,
    ] = await Promise.all([
      User.countDocuments(learnerFilter),
      User.countDocuments({ ...learnerFilter, createdAt: { $gte: monthStart } }),
      User.countDocuments({ ...learnerFilter, status: 'suspended' }),
      Course.countDocuments(),
      Course.countDocuments({ published: { $ne: false } }),
      Enrollment.aggregate([
        { $match: { amount: { $gt: 0 } } },
        { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$amount' } } },
      ]),
      Enrollment.aggregate([
        { $match: { status: 'completed', amount: { $gt: 0 }, confirmedAt: { $gte: monthStart } } },
        { $group: { _id: null, amount: { $sum: '$amount' } } },
      ]),
      Submission.countDocuments({ status: { $in: ['submitted', 'under_review'] } }),
      Certificate.countDocuments({ kind: 'course' }),
      Enrollment.find({ amount: { $gt: 0 } })
        .populate('studentId', 'name email')
        .populate('courseId', 'title')
        .sort({ updatedAt: -1 })
        .limit(6),
      User.find(learnerFilter).sort({ createdAt: -1 }).limit(6),
      // The activity log is Super-Admin-only, so its preview is too.
      req.user.staffRole() === 'super_admin' ? ActivityLog.find().sort({ createdAt: -1 }).limit(8) : [],
    ]);

    const byStatus = Object.fromEntries(paymentTotals.map((r) => [r._id, r]));

    res.json({
      learners: { total: learners, newThisMonth: newLearners, suspended },
      courses: { total: courses, published: publishedCourses },
      payments: {
        successfulAmount: byStatus.completed?.amount || 0,
        successfulCount: byStatus.completed?.count || 0,
        pendingCount: byStatus.pending?.count || 0,
        pendingAmount: byStatus.pending?.amount || 0,
        failedCount: byStatus.failed?.count || 0,
        monthAmount: monthRevenue[0]?.amount || 0,
      },
      awaitingReview,
      certificates,
      recentPayments,
      recentLearners,
      recentActivity,
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/activity?category=&search=&from=&to=&page= */
async function listActivity(req, res, next) {
  try {
    const { category, search, from, to } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = 50;

    const filter = {};
    if (category && ActivityLog.CATEGORIES.includes(category)) filter.category = category;
    if (search) {
      const pattern = new RegExp(escapeRegex(String(search).trim()), 'i');
      filter.$or = [{ summary: pattern }, { actorName: pattern }, { actorEmail: pattern }];
    }
    const range = {};
    if (from && !Number.isNaN(new Date(from).getTime())) range.$gte = new Date(from);
    if (to && !Number.isNaN(new Date(to).getTime())) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      range.$lte = end;
    }
    if (Object.keys(range).length) filter.createdAt = range;

    const [entries, total] = await Promise.all([
      ActivityLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
      ActivityLog.countDocuments(filter),
    ]);

    res.json({ entries, total, page, pages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/certificates?search=&courseId= — issued course certificates. */
async function listCertificates(req, res, next) {
  try {
    const { search, courseId } = req.query;
    const filter = { kind: 'course' };
    if (courseId) filter.courseId = courseId;
    if (search) {
      const pattern = new RegExp(escapeRegex(String(search).trim()), 'i');
      const users = await User.find({ $or: [{ name: pattern }, { email: pattern }] }).select('_id');
      filter.$or = [
        { recipientName: pattern },
        { serial: pattern },
        { courseTitle: pattern },
        { userId: { $in: users.map((u) => u._id) } },
      ];
    }

    const certificates = await Certificate.find(filter)
      .populate('userId', 'name email')
      .sort({ issuedAt: -1 })
      .limit(1000);
    res.json(certificates);
  } catch (err) {
    next(err);
  }
}

module.exports = { getOverview, listActivity, listCertificates };
