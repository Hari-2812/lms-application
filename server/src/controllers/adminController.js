const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const User = require('../models/User');
const CourseAccess = require('../models/CourseAccess');
const Resource = require('../models/Resource');
const driveService = require('../services/googleDriveService');
const { notifyUser, notifyUsers } = require('../services/notificationService');
const { sanitizeHtml } = require('../utils/sanitizeHtml');

/**
 * Everything the admin dashboard is allowed to write on a course.
 *
 * Built as an allowlist rather than spreading req.body so that a request
 * cannot reach fields the dashboard has no business setting — `driveFolderId`
 * (owned by the Drive importer) and the `lessons` array (owned by
 * addLesson/deleteLesson) in particular.
 *
 * Only keys actually present in the body are returned, so a partial edit
 * (PUT with just a thumbnail) leaves every other field alone.
 */
const TEXT_FIELDS = [
  'title', 'slug', 'description', 'summary', 'instructor', 'instructorTitle',
  'level', 'category', 'accent', 'thumbnail', 'introVideoUrl', 'language',
];
const NUMBER_FIELDS = ['hours', 'price', 'originalPrice', 'rating', 'ratingCount', 'studentsCount'];
const LIST_FIELDS = ['outcomes', 'requirements', 'features'];
const BOOLEAN_FIELDS = ['published', 'certificateIncluded', 'hasDriveVideos'];

/** Trims a bullet list, dropping blanks and capping length. */
function cleanList(value) {
  if (!Array.isArray(value)) {
    if (typeof value !== 'string') return [];
    value = value.split(/\r?\n/);
  }
  return value
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 40);
}

function buildCourseFields(body = {}) {
  const fields = {};

  for (const key of TEXT_FIELDS) {
    if (body[key] === undefined) continue;
    fields[key] = String(body[key]).trim();
  }

  for (const key of NUMBER_FIELDS) {
    if (body[key] === undefined || body[key] === '') continue;
    const number = Number(body[key]);
    if (Number.isFinite(number) && number >= 0) fields[key] = number;
  }

  for (const key of LIST_FIELDS) {
    if (body[key] === undefined) continue;
    fields[key] = cleanList(body[key]);
  }

  for (const key of BOOLEAN_FIELDS) {
    if (body[key] === undefined) continue;
    fields[key] = Boolean(body[key]);
  }

  // The formatted long description is the one field that carries markup, so
  // it is the one field that has to be sanitised.
  if (body.descriptionHtml !== undefined) {
    fields.descriptionHtml = sanitizeHtml(String(body.descriptionHtml));
  }

  return fields;
}

async function createCourse(req, res, next) {
  try {
    const fields = buildCourseFields(req.body);
    if (!fields.title) return res.status(400).json({ error: 'title is required' });
    if (!fields.slug) return res.status(400).json({ error: 'slug is required' });

    // Check if course with slug already exists
    const existingCourse = await Course.findOne({ slug: fields.slug });
    if (existingCourse) {
      return res.status(400).json({ error: 'Course with this slug already exists' });
    }

    const course = new Course({
      hasDriveVideos: true, // Assuming manually added courses have drive videos
      ...fields,
    });

    await course.save();
    res.status(201).json(course);
  } catch (err) {
    next(err);
  }
}

async function addLesson(req, res, next) {
  try {
    const { courseId, title, description, date, driveLink } = req.body;

    if (!courseId || !title || !driveLink) {
      return res.status(400).json({ error: 'courseId, title, and driveLink are required' });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Extract driveFileId from the link using the service
    // normaliseFolderId works for file IDs too
    const driveFileId = driveService.normaliseFolderId(driveLink);
    if (!driveFileId) {
      return res.status(400).json({ error: 'Invalid Google Drive link' });
    }

    // Check if lesson already exists to prevent duplicates
    const existingLesson = await Lesson.findOne({ courseId, driveFileId });
    if (existingLesson) {
      return res.status(400).json({ error: 'Lesson with this Drive video already exists in the course' });
    }

    // Fetch metadata from Google Drive
    let driveMetadata;
    try {
      driveMetadata = await driveService.getVideoMetadata(driveFileId);
    } catch (err) {
      console.error('[admin] Failed to fetch drive metadata:', err.message);
      
      const errorMessage = err.status === 404 
        ? 'Drive file was not found, or is not shared with the service account.'
        : err.status === 403
        ? 'Google refused access to this file. Check that the Drive API is enabled.'
        : err.message || 'Could not fetch Drive metadata. Ensure the file is shared with the service account.';
        
      return res.status(400).json({ error: errorMessage });
    }

    // Get the next order number
    const lastLesson = await Lesson.findOne({ courseId }).sort('-order');
    const order = lastLesson ? lastLesson.order + 1 : 1;

    const lesson = new Lesson({
      courseId,
      title,
      description,
      date,
      order,
      driveFileId,
      driveFileName: driveMetadata.name,
      driveWebViewLink: driveMetadata.webViewLink,
      mimeType: driveMetadata.mimeType,
      duration: driveMetadata.durationSeconds,
      folderId: driveMetadata.folderId,
      folderName: driveMetadata.folderName
    });

    await lesson.save();

    // Update course to include this lesson in the array
    course.lessons.push(lesson._id);
    await course.save();

    // Notify every student who currently has access to this course.
    const grants = await CourseAccess.find({ courseId: course._id, active: true }).select('studentId');
    await notifyUsers(
      grants.map((g) => g.studentId),
      {
        type: 'new_lesson',
        title: 'New lesson added',
        message: `"${lesson.title}" was added to ${course.title}`,
        courseId: course._id,
      }
    );

    res.status(201).json(lesson);
  } catch (err) {
    next(err);
  }
}

async function deleteCourse(req, res, next) {
  try {
    const { id } = req.params;
    
    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Delete associated lessons
    await Lesson.deleteMany({ courseId: id });
    
    // Delete the course
    await Course.findByIdAndDelete(id);
    
    res.json({ success: true, message: 'Course deleted successfully' });
  } catch (err) {
    next(err);
  }
}

async function deleteLesson(req, res, next) {
  try {
    const { id } = req.params;
    
    const lesson = await Lesson.findById(id);
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    // Remove lesson ID from course.lessons array
    await Course.findByIdAndUpdate(lesson.courseId, {
      $pull: { lessons: id }
    });

    // Delete the lesson
    await Lesson.findByIdAndDelete(id);
    
    res.json({ success: true, message: 'Lesson deleted successfully' });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/admin/courses/:id
 *
 * Accepts any subset of the course content fields, so the dashboard can save
 * one panel at a time. Pass `notifyStudents: true` to tell everyone who
 * currently has access that the course content changed.
 */
async function updateCourse(req, res, next) {
  try {
    const { id } = req.params;
    const fields = buildCourseFields(req.body);

    if (fields.slug) {
      const clash = await Course.findOne({ slug: fields.slug, _id: { $ne: id } });
      if (clash) return res.status(400).json({ error: 'Another course already uses this slug' });
    }

    const course = await Course.findByIdAndUpdate(id, fields, { new: true, runValidators: true });

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (req.body?.notifyStudents) {
      const grants = await CourseAccess.find({ courseId: course._id, active: true }).select('studentId');
      await notifyUsers(
        grants.map((g) => g.studentId),
        {
          type: 'course_update',
          title: 'Course updated',
          message: `"${course.title}" has been updated with new content.`,
          courseId: course._id,
          link: `/my-courses/${course._id}`,
        }
      );
    }

    res.json(course);
  } catch (err) {
    next(err);
  }
}

async function updateLesson(req, res, next) {
  try {
    const { id } = req.params;
    const { title, description, date } = req.body;
    
    const lesson = await Lesson.findByIdAndUpdate(
      id,
      { title, description, date },
      { new: true }
    );
    
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }
    
    res.json(lesson);
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/courses/stats — enrolled-student count per course, for the admin overview chart. */
async function getCourseStats(req, res, next) {
  try {
    const [courses, counts, lessonCounts] = await Promise.all([
      Course.find().select('title slug').sort({ createdAt: 1 }),
      CourseAccess.aggregate([
        { $match: { active: true } },
        { $group: { _id: '$courseId', count: { $sum: 1 } } },
      ]),
      Lesson.aggregate([{ $group: { _id: '$courseId', count: { $sum: 1 } } }]),
    ]);

    const enrolledByCourse = new Map(counts.map((r) => [String(r._id), r.count]));
    const lessonsByCourse = new Map(lessonCounts.map((r) => [String(r._id), r.count]));

    res.json(
      courses.map((course) => ({
        courseId: course._id,
        title: course.title,
        enrolledCount: enrolledByCourse.get(String(course._id)) || 0,
        lessonCount: lessonsByCourse.get(String(course._id)) || 0,
      }))
    );
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/students */
async function listStudents(req, res, next) {
  try {
    // $ne (not $eq 'student') also matches accounts created before the role
    // field existed, which never got it persisted to their stored document.
    const students = await User.find({ role: { $ne: 'admin' } }).sort({ createdAt: -1 });
    const grantCounts = await CourseAccess.aggregate([
      { $match: { active: true } },
      { $group: { _id: '$studentId', count: { $sum: 1 } } },
    ]);
    const countByStudent = new Map(grantCounts.map((r) => [String(r._id), r.count]));

    res.json(
      students.map((student) => ({
        ...student.toJSON(),
        accessCount: countByStudent.get(String(student._id)) || 0,
      }))
    );
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/students/:studentId/access */
async function getStudentAccess(req, res, next) {
  try {
    const { studentId } = req.params;

    const student = await User.findById(studentId);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const [courses, grants] = await Promise.all([
      Course.find().sort({ createdAt: 1 }),
      CourseAccess.find({ studentId, active: true }).select('courseId'),
    ]);
    const grantedCourseIds = new Set(grants.map((g) => String(g.courseId)));

    res.json(
      courses.map((course) => ({
        courseId: course._id,
        title: course.title,
        slug: course.slug,
        granted: grantedCourseIds.has(String(course._id)),
      }))
    );
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/access  body: { studentId, courseId } */
async function grantAccess(req, res, next) {
  try {
    const { studentId, courseId } = req.body || {};
    if (!studentId || !courseId) {
      return res.status(400).json({ error: 'studentId and courseId are required' });
    }

    const [student, course] = await Promise.all([User.findById(studentId), Course.findById(courseId)]);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const grant = await CourseAccess.findOneAndUpdate(
      { studentId, courseId },
      { studentId, courseId, active: true, grantedBy: req.user._id },
      { new: true, upsert: true }
    );

    await notifyUser(studentId, {
      type: 'access_granted',
      title: 'Course access granted',
      message: `You now have access to "${course.title}"`,
      courseId: course._id,
    });

    res.json(grant);
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/admin/access  body: { studentId, courseId } */
async function revokeAccess(req, res, next) {
  try {
    const { studentId, courseId } = req.body || {};
    if (!studentId || !courseId) {
      return res.status(400).json({ error: 'studentId and courseId are required' });
    }

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const grant = await CourseAccess.findOneAndUpdate(
      { studentId, courseId },
      { active: false },
      { new: true }
    );
    if (!grant) return res.status(404).json({ error: 'No access grant found for this student/course' });

    await notifyUser(studentId, {
      type: 'access_revoked',
      title: 'Course access revoked',
      message: `Your access to "${course.title}" was revoked`,
      courseId: course._id,
    });

    res.json(grant);
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/access/bulk  body: { studentIds: [], courseId } */
async function bulkGrantAccess(req, res, next) {
  try {
    const { studentIds, courseId } = req.body || {};
    if (!Array.isArray(studentIds) || !studentIds.length || !courseId) {
      return res.status(400).json({ error: 'studentIds (non-empty array) and courseId are required' });
    }

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    await Promise.all(
      studentIds.map((studentId) =>
        CourseAccess.findOneAndUpdate(
          { studentId, courseId },
          { studentId, courseId, active: true, grantedBy: req.user._id },
          { upsert: true }
        )
      )
    );

    await notifyUsers(studentIds, {
      type: 'access_granted',
      title: 'Course access granted',
      message: `You now have access to "${course.title}"`,
      courseId: course._id,
    });

    res.json({ success: true, granted: studentIds.length });
  } catch (err) {
    next(err);
  }
}

// What the admin composer is allowed to send. Everything else in the
// Notification enum is raised by the system itself (access grants, new
// lessons, milestones, certificates, payments) and is not sendable by hand.
const SENDABLE_TYPES = new Set(['announcement', 'course_update', 'task', 'event', 'certificate']);

const DEFAULT_TITLES = {
  announcement: 'Announcement',
  course_update: 'Course update',
  task: 'Task assigned',
  event: 'Upcoming event',
  certificate: 'Certificate update',
};

/**
 * POST /api/admin/notifications
 * body: { studentId?, courseId?, message, type?, title?, link? }
 *
 * Targets one student, everyone with access to one course, or every student.
 */
async function broadcastNotification(req, res, next) {
  try {
    const { studentId, courseId, message, type, title, link } = req.body || {};
    if (!message) return res.status(400).json({ error: 'message is required' });

    const resolvedType = SENDABLE_TYPES.has(type) ? type : 'announcement';

    const payload = {
      type: resolvedType,
      title: String(title || '').trim() || DEFAULT_TITLES[resolvedType],
      message: String(message).trim(),
      courseId,
      // An in-app path only — an absolute URL here would turn every
      // notification into an open redirect off the dashboard.
      link: typeof link === 'string' && link.startsWith('/') ? link : '',
    };

    if (studentId) {
      await notifyUser(studentId, payload);
      return res.json({ success: true, targeted: 1 });
    }

    if (courseId) {
      const grants = await CourseAccess.find({ courseId, active: true }).select('studentId');
      const ids = grants.map((g) => g.studentId);
      await notifyUsers(ids, payload);
      return res.json({ success: true, targeted: ids.length });
    }

    // $ne (not $eq 'student') also matches accounts created before the role
    // field existed, which never got it persisted to their stored document.
    const students = await User.find({ role: { $ne: 'admin' } }).select('_id');
    const ids = students.map((s) => s._id);
    await notifyUsers(ids, payload);
    res.json({ success: true, targeted: ids.length });
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/resources  body: { courseId, title, description, url, type } */
async function addResource(req, res, next) {
  try {
    const { courseId, title, description, url, type } = req.body || {};
    if (!courseId || !title || !url) {
      return res.status(400).json({ error: 'courseId, title, and url are required' });
    }

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const resource = await Resource.create({ courseId, title, description, url, type });
    res.status(201).json(resource);
  } catch (err) {
    next(err);
  }
}

/** PUT /api/admin/resources/:id */
async function updateResource(req, res, next) {
  try {
    const { title, description, url, type } = req.body || {};
    const resource = await Resource.findByIdAndUpdate(
      req.params.id,
      { title, description, url, type },
      { new: true }
    );
    if (!resource) return res.status(404).json({ error: 'Resource not found' });
    res.json(resource);
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/admin/resources/:id */
async function deleteResource(req, res, next) {
  try {
    const resource = await Resource.findByIdAndDelete(req.params.id);
    if (!resource) return res.status(404).json({ error: 'Resource not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createCourse,
  addLesson,
  deleteCourse,
  deleteLesson,
  updateCourse,
  updateLesson,
  getCourseStats,
  listStudents,
  getStudentAccess,
  grantAccess,
  revokeAccess,
  bulkGrantAccess,
  broadcastNotification,
  addResource,
  updateResource,
  deleteResource,
};
