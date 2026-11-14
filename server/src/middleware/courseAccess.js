const mongoose = require('mongoose');
const Lesson = require('../models/Lesson');
const { courseAccessFor } = require('../services/enrolmentService');
const lessonProgress = require('../services/lessonProgressService');

/**
 * Gate for a course's lessons, video stream, progress and reviews. Lets
 * through staff, learners with Full Access, and learners with a live grant
 * for the course (admin-granted, paid or free) — see enrolmentService.
 */
function requireCourseAccess(resolveCourseId) {
  return async function (req, res, next) {
    try {
      const courseId = await resolveCourseId(req);
      if (!courseId || !mongoose.isValidObjectId(courseId)) {
        return res.status(404).json({ error: 'Course not found' });
      }

      const access = await courseAccessFor(req.user, courseId);
      if (!access.allowed) {
        return res.status(403).json({
          error:
            access.reason === 'expired'
              ? 'Your access to this course has expired'
              : 'You do not have access to this course',
        });
      }

      req.courseId = courseId;
      req.courseAccess = access;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Sequential unlocking: refuses a lesson the learner has not reached yet —
 * its details, its video stream (so a copied stream URL does not work either)
 * and progress saves for it. Runs after requireCourseAccess, which supplies
 * req.courseId and req.courseAccess. Staff are never locked out.
 */
function requireLessonUnlocked(resolveLessonId) {
  return async function (req, res, next) {
    try {
      const lessonId = await resolveLessonId(req);
      // Missing or malformed ids are left for the handler to 404.
      if (!lessonId || !mongoose.isValidObjectId(lessonId)) return next();

      const locked = await lessonProgress.isLessonLocked({
        studentId: req.user.id,
        courseId: req.courseId,
        lessonId,
        access: req.courseAccess,
      });
      if (locked) {
        return res.status(403).json({
          error: 'This lesson is locked. Finish the previous lesson to unlock it.',
          code: 'LESSON_LOCKED',
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** A lesson id from the request, or null when it is missing or malformed (→ 404, not a 500). */
async function courseOfLesson(lessonId) {
  if (!mongoose.isValidObjectId(lessonId)) return null;
  const lesson = await Lesson.findById(lessonId).select('courseId');
  return lesson?.courseId;
}

/** Resolvers for the routes that need them — kept next to the middleware that uses them. */
const resolveCourseId = {
  fromParam: (paramName) => (req) => req.params[paramName],
  fromBody: (fieldName) => (req) => req.body?.[fieldName],
  fromLessonParam: (paramName) => (req) => courseOfLesson(req.params[paramName]),
  fromLessonBody: (fieldName) => (req) => courseOfLesson(req.body?.[fieldName]),
};

/** Where requireLessonUnlocked finds the lesson id. */
const resolveLessonId = {
  fromParam: (paramName) => (req) => req.params[paramName],
  fromBody: (fieldName) => (req) => req.body?.[fieldName],
};

module.exports = { requireCourseAccess, resolveCourseId, requireLessonUnlocked, resolveLessonId };
