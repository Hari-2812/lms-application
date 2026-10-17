const Lesson = require('../models/Lesson');
const CourseAccess = require('../models/CourseAccess');
const { isGrantLive } = require('../services/enrolmentService');


function requireCourseAccess(resolveCourseId) {
  return async function (req, res, next) {
    try {
      if (req.user.role === 'admin') return next();

      const courseId = await resolveCourseId(req);
      if (!courseId) return res.status(404).json({ error: 'Course not found' });

      const grant = await CourseAccess.findOne({
        studentId: req.user._id,
        courseId,
        active: true,
      });

      if (!grant) {
        return res.status(403).json({ error: 'You do not have access to this course' });
      }
      if (!isGrantLive(grant)) {
        return res.status(403).json({ error: 'Your access to this course has expired' });
      }

      req.courseId = courseId;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Resolvers for the routes that need them — kept next to the middleware that uses them. */
const resolveCourseId = {
  fromParam: (paramName) => (req) => req.params[paramName],
  fromBody: (fieldName) => (req) => req.body?.[fieldName],
  fromLessonParam: (paramName) => async (req) => {
    const lesson = await Lesson.findById(req.params[paramName]).select('courseId');
    return lesson?.courseId;
  },
  fromLessonBody: (fieldName) => async (req) => {
    const lesson = await Lesson.findById(req.body?.[fieldName]).select('courseId');
    return lesson?.courseId;
  },
};

module.exports = { requireCourseAccess, resolveCourseId };
