const express = require('express');
const courseController = require('../controllers/courseController');
const lessonController = require('../controllers/lessonController');
const videoController = require('../controllers/videoController');
const progressController = require('../controllers/progressController');
const { DEMO_STUDENT } = require('../middleware/mockAuth');
const driveService = require('../services/googleDriveService');

const router = express.Router();

// --- demo session (mocked auth) ---
router.get('/me', (req, res) => res.json(req.student));

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
    student: DEMO_STUDENT.name,
  });
});

// --- courses ---
router.get('/courses', courseController.listCourses);
router.get('/courses/:id', courseController.getCourse);

// --- lessons ---
router.get('/courses/:courseId/lessons', lessonController.listLessonsForCourse);
router.get('/lessons/:id', lessonController.getLesson);

// --- video (the demo's core endpoint) ---
router.get('/videos/:lessonId/stream', videoController.streamLessonVideo);
router.get('/videos/:lessonId/info', videoController.getVideoInfo);

// --- progress ---
router.post('/progress', progressController.saveProgress);
router.get('/progress/:lessonId', progressController.getProgress);

module.exports = router;
