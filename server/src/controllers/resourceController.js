const mongoose = require('mongoose');
const Course = require('../models/Course');
const Resource = require('../models/Resource');
const ResourceAccess = require('../models/ResourceAccess');
const { courseAccessFor, grantedCourseIds } = require('../services/enrolmentService');

/**
 * Study materials (PDFs, slides, documents, links).
 *
 * A learner sees all of a course's materials when they can open the course
 * (Full Access or a course grant), or just the individual materials an admin
 * shared with them (Limited Access → selected materials).
 */

/** GET /api/courses/:courseId/resources */
async function listResourcesForCourse(req, res, next) {
  try {
    const { courseId } = req.params;
    if (!mongoose.isValidObjectId(courseId)) return res.status(404).json({ error: 'Course not found' });

    const access = await courseAccessFor(req.user, courseId);
    if (access.allowed) {
      const resources = await Resource.find({ courseId }).sort({ createdAt: 1 });
      return res.json(resources);
    }

    const shared = await ResourceAccess.find({ studentId: req.user._id, courseId }).select('resourceId');
    if (!shared.length) {
      return res.status(403).json({
        error: access.reason === 'expired' ? 'Your access to this course has expired' : 'You do not have access to this course',
      });
    }
    const resources = await Resource.find({ _id: { $in: shared.map((s) => s.resourceId) } }).sort({ createdAt: 1 });
    res.json(resources);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/resources/mine — every material this learner can open, grouped by
 * course: [{ course, access: 'full' | 'course' | 'selected', resources }].
 */
async function listMine(req, res, next) {
  try {
    const user = req.user;
    const everything = user.role === 'admin' || user.fullAccess;

    const [courseIds, shared] = await Promise.all([
      everything ? null : grantedCourseIds(user._id),
      everything ? [] : ResourceAccess.find({ studentId: user._id }).select('resourceId courseId'),
    ]);

    const courseFilter = everything
      ? { published: { $ne: false } }
      : { _id: { $in: [...courseIds, ...shared.map((s) => s.courseId)] } };
    if (user.role === 'admin') delete courseFilter.published;

    const courses = await Course.find(courseFilter).select('title thumbnail accent category').sort({ createdAt: 1 });
    const fullCourseIds = new Set(everything ? courses.map((c) => String(c._id)) : courseIds.map(String));
    const sharedIds = shared.map((s) => s.resourceId);

    const resources = await Resource.find({
      $or: [{ courseId: { $in: [...fullCourseIds] } }, { _id: { $in: sharedIds } }],
    }).sort({ createdAt: 1 });

    const byCourse = new Map();
    for (const resource of resources) {
      const key = String(resource.courseId);
      if (!byCourse.has(key)) byCourse.set(key, []);
      byCourse.get(key).push(resource);
    }

    res.json(
      courses.map((course) => {
        const key = String(course._id);
        return {
          course: { _id: course._id, title: course.title, thumbnail: course.thumbnail, accent: course.accent, category: course.category },
          access: fullCourseIds.has(key) ? (everything ? 'full' : 'course') : 'selected',
          resources: byCourse.get(key) || [],
        };
      })
    );
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/resources — every material, for the per-learner picker. */
async function listAll(_req, res, next) {
  try {
    const resources = await Resource.find().populate('courseId', 'title').sort({ courseId: 1, createdAt: 1 });
    res.json(
      resources.map((r) => ({
        ...r.toJSON(),
        courseId: r.courseId?._id || r.courseId,
        courseTitle: r.courseId?.title || 'Deleted course',
      }))
    );
  } catch (err) {
    next(err);
  }
}

module.exports = { listResourcesForCourse, listMine, listAll };
