const express = require('express');
const courseController = require('../controllers/courseController');
const lessonController = require('../controllers/lessonController');
const videoController = require('../controllers/videoController');
const progressController = require('../controllers/progressController');
const adminController = require('../controllers/adminController');
const authController = require('../controllers/authController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
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

// --- courses ---
router.get('/courses', courseController.listCourses);
router.get('/courses/:id', courseController.getCourse);

// --- admin courses ---
router.post('/admin/courses', requireAuth, requireAdmin, adminController.createCourse);
router.put('/admin/courses/:id', requireAuth, requireAdmin, adminController.updateCourse);
router.delete('/admin/courses/:id', requireAuth, requireAdmin, adminController.deleteCourse);

// --- lessons ---
router.get('/courses/:courseId/lessons', lessonController.listLessonsForCourse);
router.get('/lessons/:id', lessonController.getLesson);

// --- admin lessons ---
router.post('/admin/lessons', requireAuth, requireAdmin, adminController.addLesson);
router.put('/admin/lessons/:id', requireAuth, requireAdmin, adminController.updateLesson);
router.delete('/admin/lessons/:id', requireAuth, requireAdmin, adminController.deleteLesson);

// --- video (the demo's core endpoint) ---
router.get('/videos/:lessonId/stream', requireAuth, videoController.streamLessonVideo);
router.get('/videos/:lessonId/info', requireAuth, videoController.getVideoInfo);

// --- progress ---
router.post('/progress', requireAuth, progressController.saveProgress);
router.get('/progress/:lessonId', requireAuth, progressController.getProgress);

module.exports = router;
