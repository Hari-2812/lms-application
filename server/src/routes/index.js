const express = require('express');
const courseController = require('../controllers/courseController');
const lessonController = require('../controllers/lessonController');
const videoController = require('../controllers/videoController');
const progressController = require('../controllers/progressController');
const notificationController = require('../controllers/notificationController');
const resourceController = require('../controllers/resourceController');
const adminController = require('../controllers/adminController');
const authController = require('../controllers/authController');
const certificateController = require('../controllers/certificateController');
const enrollmentController = require('../controllers/enrollmentController');
const uploadController = require('../controllers/uploadController');
const eventController = require('../controllers/eventController');
const submissionController = require('../controllers/submissionController');
const { requireAuth, optionalAuth, requireAdmin } = require('../middleware/authMiddleware');
const { requireCourseAccess, resolveCourseId } = require('../middleware/courseAccess');
const { uploadThumbnail } = require('../middleware/upload');
const driveService = require('../services/googleDriveService');

const router = express.Router();

// --- auth ---
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.post('/auth/logout', authController.logout);

// --- me ---
router.get('/me', requireAuth, authController.getMe);

// --- health / architecture panel ---
router.get('/health', (_req, res) => {
  const drive = driveService.getConfigSummary();

  res.json({
    status: 'ok',
    videoSource: drive.configured ? 'google-drive' : 'local-demo-media',
    driveConfigured: drive.configured,
    // Booleans only. The service-account address, private key and Drive file
    // ids stay server-side — this endpoint is unauthenticated.
    driveFolderConfigured: Boolean(drive.folderId),
    student: 'Real Auth Enabled',
  });
});

// --- courses (publicly browsable; `hasAccess` reflects whoever, if anyone, is signed in) ---
router.get('/courses', optionalAuth, courseController.listCourses);
router.get('/courses/:id', optionalAuth, courseController.getCourse);

// --- admin courses ---
router.post('/admin/courses', requireAuth, requireAdmin, adminController.createCourse);
router.put('/admin/courses/:id', requireAuth, requireAdmin, adminController.updateCourse);
router.delete('/admin/courses/:id', requireAuth, requireAdmin, adminController.deleteCourse);

// --- admin: overview stats ---
router.get('/admin/courses/stats', requireAuth, requireAdmin, adminController.getCourseStats);

// --- admin: enrolments / payment confirmation ---
router.get('/admin/enrollments', requireAuth, requireAdmin, enrollmentController.listAll);
router.post('/admin/enrollments/:id/confirm', requireAuth, requireAdmin, enrollmentController.confirm);
router.post('/admin/enrollments/:id/cancel', requireAuth, requireAdmin, enrollmentController.cancel);

// --- admin: per-student course access ---
router.get('/admin/students', requireAuth, requireAdmin, adminController.listStudents);
router.get('/admin/students/:studentId/access', requireAuth, requireAdmin, adminController.getStudentAccess);
router.post('/admin/access', requireAuth, requireAdmin, adminController.grantAccess);
router.delete('/admin/access', requireAuth, requireAdmin, adminController.revokeAccess);
router.post('/admin/access/bulk', requireAuth, requireAdmin, adminController.bulkGrantAccess);

// --- admin: image uploads (course thumbnails) ---
router.post(
  '/admin/uploads/image',
  requireAuth,
  requireAdmin,
  uploadThumbnail,
  uploadController.uploadImage
);
router.delete(
  '/admin/uploads/thumbnails/:filename',
  requireAuth,
  requireAdmin,
  uploadController.deleteImage
);

// --- admin: announcements ---
router.post('/admin/notifications', requireAuth, requireAdmin, adminController.broadcastNotification);

// --- lessons (require an active access grant for the lesson's course) ---
router.get(
  '/courses/:courseId/lessons',
  requireAuth,
  requireCourseAccess(resolveCourseId.fromParam('courseId')),
  lessonController.listLessonsForCourse
);
router.get(
  '/lessons/:id',
  requireAuth,
  requireCourseAccess(resolveCourseId.fromLessonParam('id')),
  lessonController.getLesson
);

// --- admin lessons ---
router.post('/admin/lessons', requireAuth, requireAdmin, adminController.addLesson);
router.put('/admin/lessons/:id', requireAuth, requireAdmin, adminController.updateLesson);
router.delete('/admin/lessons/:id', requireAuth, requireAdmin, adminController.deleteLesson);

// --- resources (study materials / PDFs) — same access grant as lessons ---
router.get(
  '/courses/:courseId/resources',
  requireAuth,
  requireCourseAccess(resolveCourseId.fromParam('courseId')),
  resourceController.listResourcesForCourse
);

// --- admin resources ---
router.post('/admin/resources', requireAuth, requireAdmin, adminController.addResource);
router.put('/admin/resources/:id', requireAuth, requireAdmin, adminController.updateResource);
router.delete('/admin/resources/:id', requireAuth, requireAdmin, adminController.deleteResource);

// --- video (the demo's core endpoint) ---
router.get(
  '/videos/:lessonId/stream',
  requireAuth,
  requireCourseAccess(resolveCourseId.fromLessonParam('lessonId')),
  videoController.streamLessonVideo
);
router.get(
  '/videos/:lessonId/info',
  requireAuth,
  requireCourseAccess(resolveCourseId.fromLessonParam('lessonId')),
  videoController.getVideoInfo
);

// --- progress ---
router.post(
  '/progress',
  requireAuth,
  requireCourseAccess(resolveCourseId.fromLessonBody('lessonId')),
  progressController.saveProgress
);
router.get('/progress/:lessonId', requireAuth, progressController.getProgress);

// --- notifications ---
router.get('/notifications', requireAuth, notificationController.listNotifications);
router.patch('/notifications/:id/read', requireAuth, notificationController.markRead);
router.patch('/notifications/read-all', requireAuth, notificationController.markAllRead);

// --- upcoming events (publicly browsable) ---
router.get('/events', optionalAuth, eventController.listEvents);
router.get('/events/:id', optionalAuth, eventController.getEvent);

// --- admin: events ---
router.get('/admin/events', requireAuth, requireAdmin, eventController.listAllEvents);
router.post('/admin/events', requireAuth, requireAdmin, eventController.createEvent);
router.put('/admin/events/:id', requireAuth, requireAdmin, eventController.updateEvent);
router.delete('/admin/events/:id', requireAuth, requireAdmin, eventController.deleteEvent);

// --- task submissions ---
// The category list is public so the form can render before anything is sent.
router.get('/submissions/categories', submissionController.listCategories);
router.get('/submissions/mine', requireAuth, submissionController.listMine);
router.post('/submissions', requireAuth, submissionController.createSubmission);
router.delete('/submissions/:id', requireAuth, submissionController.withdraw);

// --- admin: submission review queue ---
router.get('/admin/submissions', requireAuth, requireAdmin, submissionController.listAll);
router.patch('/admin/submissions/:id', requireAuth, requireAdmin, submissionController.review);

// --- certificates ---
// `verify` is public on purpose: a certificate serial is meant to be
// checkable by an employer who has no account here. It is declared before
// the authenticated routes so the more specific path wins.
router.get('/certificates/verify/:serial', certificateController.verify);
router.get('/certificates', requireAuth, certificateController.listMine);
router.post('/certificates/issue', requireAuth, certificateController.issue);
// The sample flow works signed out (preview only) and signed in (saved).
router.post('/certificates/sample', optionalAuth, certificateController.sample);
router.delete('/certificates/:id', requireAuth, certificateController.remove);

// --- enrolment / checkout ---
router.post('/enrollments', requireAuth, enrollmentController.enrol);
router.get('/enrollments/mine', requireAuth, enrollmentController.listMine);

module.exports = router;
