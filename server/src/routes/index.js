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
const learnerController = require('../controllers/learnerController');
const paymentController = require('../controllers/paymentController');
const assignmentController = require('../controllers/assignmentController');
const settingsController = require('../controllers/settingsController');
const teamController = require('../controllers/teamController');
const insightsController = require('../controllers/adminInsightsController');
const reviewController = require('../controllers/reviewController');
const enquiryController = require('../controllers/enquiryController');
const { requireAuth, optionalAuth, requireAdmin, requireSuperAdmin } = require('../middleware/authMiddleware');
const {
  requireCourseAccess,
  resolveCourseId,
  requireLessonUnlocked,
  resolveLessonId,
} = require('../middleware/courseAccess');
const { uploadThumbnail } = require('../middleware/upload');
const driveService = require('../services/googleDriveService');

const router = express.Router();

/**
 * Two staff guards:
 *   staff — any admin account, including Support / Reviewer
 *   superAdmin — money, access, content, settings and the team
 */
const staff = [requireAuth, requireAdmin];
const superAdmin = [requireAuth, requireSuperAdmin];

// --- auth ---
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.post('/auth/logout', authController.logout);
router.post('/auth/forgot-password', authController.forgotPassword);
router.post('/auth/reset-password', authController.resetPassword);

// --- me ---
router.get('/me', requireAuth, authController.getMe);
router.put('/me', requireAuth, authController.updateMe);
router.put('/me/password', requireAuth, authController.changePassword);

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

// --- platform settings anyone may read (branding, how to pay) ---
router.get('/settings/public', settingsController.getPublic);

// --- courses (publicly browsable; `hasAccess` reflects whoever, if anyone, is signed in) ---
router.get('/courses', optionalAuth, courseController.listCourses);
router.get('/courses/:id', optionalAuth, courseController.getCourse);

// --- admin courses ---
router.post('/admin/courses', ...superAdmin, adminController.createCourse);
router.put('/admin/courses/:id', ...superAdmin, adminController.updateCourse);
router.delete('/admin/courses/:id', ...superAdmin, adminController.deleteCourse);

// --- admin: overview ---
router.get('/admin/courses/stats', ...staff, adminController.getCourseStats);
router.get('/admin/overview', ...staff, insightsController.getOverview);

// --- admin: learners ---
router.get('/admin/learners', ...staff, learnerController.listLearners);
router.get('/admin/learners/:id', ...staff, learnerController.getLearner);
router.patch('/admin/learners/:id/status', ...superAdmin, learnerController.setLearnerStatus);
// Full Access (every course, now and later) and Limited Access to selected materials.
router.patch('/admin/learners/:id/full-access', ...superAdmin, learnerController.setLearnerFullAccess);
router.put('/admin/learners/:id/materials', ...superAdmin, learnerController.setLearnerMaterials);
router.post('/admin/learners/:id/enrol', ...superAdmin, learnerController.enrolLearner);
router.delete('/admin/learners/:id/enrol/:courseId', ...superAdmin, learnerController.unenrolLearner);
router.post('/admin/users/:id/reset-password', ...superAdmin, learnerController.resetUserPassword);

// --- admin: per-student course access (used by the notification composer) ---
router.get('/admin/students', ...staff, adminController.listStudents);
router.get('/admin/students/:studentId/access', ...staff, adminController.getStudentAccess);
router.post('/admin/access', ...superAdmin, adminController.grantAccess);
router.delete('/admin/access', ...superAdmin, adminController.revokeAccess);
router.post('/admin/access/bulk', ...superAdmin, adminController.bulkGrantAccess);

// --- admin: payments ---
// report.pdf is declared before /:id routes so the literal path wins.
router.get('/admin/payments', ...staff, paymentController.listPayments);
router.get('/admin/payments/report.pdf', ...staff, paymentController.downloadReport);
router.patch('/admin/payments/:id', ...superAdmin, paymentController.updatePayment);
router.post('/admin/payments/:id/confirm', ...superAdmin, paymentController.confirmPayment);
router.post('/admin/payments/:id/fail', ...superAdmin, paymentController.failPayment);
router.post('/admin/payments/:id/cancel', ...superAdmin, paymentController.cancelPayment);
router.post('/admin/payments/:id/retry', ...superAdmin, paymentController.retryPayment);
router.get('/admin/enrollments', ...staff, enrollmentController.listAll);

// --- admin: image uploads (course thumbnails, platform logo) ---
router.post('/admin/uploads/image', ...superAdmin, uploadThumbnail, uploadController.uploadImage);
router.delete('/admin/uploads/thumbnails/:filename', ...superAdmin, uploadController.deleteImage);

// --- admin: notifications composer ---
router.post('/admin/notifications', ...staff, adminController.broadcastNotification);

// --- admin: certificates register (and the template preview) ---
router.get('/admin/certificates', ...staff, insightsController.listCertificates);
router.post('/admin/certificates/sample', ...staff, certificateController.sample);

// --- admin: course reviews (Support / Reviewer can moderate) ---
router.get('/admin/reviews', ...staff, reviewController.listAll);
router.patch('/admin/reviews/:id', ...staff, reviewController.moderate);
router.delete('/admin/reviews/:id', ...staff, reviewController.remove);

// --- admin: "Enroll Now" enquiries and their Google Sheet copy ---
// The literal /sync path is declared before /:id/sync.
router.get('/admin/enquiries', ...staff, enquiryController.listAll);
router.post('/admin/enquiries/sync', ...staff, enquiryController.resyncAll);
router.post('/admin/enquiries/:id/sync', ...staff, enquiryController.resync);
router.post('/admin/integrations/google-sheet/test', ...superAdmin, enquiryController.testSheet);

// --- admin: settings, team, activity log ---
router.get('/admin/settings', ...superAdmin, settingsController.getAdmin);
router.put('/admin/settings', ...superAdmin, settingsController.updateAdmin);
router.post('/admin/settings/test-email', ...superAdmin, settingsController.sendTestEmail);
router.get('/admin/team', ...superAdmin, teamController.listTeam);
router.post('/admin/team', ...superAdmin, teamController.addMember);
router.patch('/admin/team/:id', ...superAdmin, teamController.updateMember);
router.get('/admin/activity', ...superAdmin, insightsController.listActivity);

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
  requireLessonUnlocked(resolveLessonId.fromParam('id')),
  lessonController.getLesson
);

// --- admin lessons ---
router.post('/admin/lessons', ...superAdmin, adminController.addLesson);
router.put('/admin/lessons/:id', ...superAdmin, adminController.updateLesson);
router.delete('/admin/lessons/:id', ...superAdmin, adminController.deleteLesson);

// --- resources (study materials / PDFs) ---
// Course access (or Full Access) shows all of a course's materials; Limited
// Access shows just the ones shared with the learner. The controller decides.
router.get('/courses/:courseId/resources', requireAuth, resourceController.listResourcesForCourse);
router.get('/resources/mine', requireAuth, resourceController.listMine);

// --- course reviews ---
router.get('/courses/:courseId/reviews', optionalAuth, reviewController.listForCourse);
router.post(
  '/courses/:courseId/reviews',
  requireAuth,
  requireCourseAccess(resolveCourseId.fromParam('courseId')),
  reviewController.saveMine
);
router.delete('/courses/:courseId/reviews/mine', requireAuth, reviewController.deleteMine);

// --- "Enroll Now" enquiry form (public; copied to the Google Sheet) ---
router.get('/enquiries/options', enquiryController.options);
router.post('/enquiries', optionalAuth, enquiryController.create);

// --- admin resources ---
router.get('/admin/resources', ...staff, resourceController.listAll);
router.post('/admin/resources', ...superAdmin, adminController.addResource);
router.put('/admin/resources/:id', ...superAdmin, adminController.updateResource);
router.delete('/admin/resources/:id', ...superAdmin, adminController.deleteResource);

// --- video (the demo's core endpoint) ---
router.get(
  '/videos/:lessonId/stream',
  requireAuth,
  requireCourseAccess(resolveCourseId.fromLessonParam('lessonId')),
  // Sequential unlocking applies to the stream itself, so a copied URL for a
  // locked lesson does not play either.
  requireLessonUnlocked(resolveLessonId.fromParam('lessonId')),
  videoController.streamLessonVideo
);
router.get(
  '/videos/:lessonId/info',
  requireAuth,
  requireCourseAccess(resolveCourseId.fromLessonParam('lessonId')),
  requireLessonUnlocked(resolveLessonId.fromParam('lessonId')),
  videoController.getVideoInfo
);

// --- progress ---
router.post(
  '/progress',
  requireAuth,
  requireCourseAccess(resolveCourseId.fromLessonBody('lessonId')),
  requireLessonUnlocked(resolveLessonId.fromBody('lessonId')),
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
router.get('/admin/events', ...staff, eventController.listAllEvents);
router.post('/admin/events', ...superAdmin, eventController.createEvent);
router.put('/admin/events/:id', ...superAdmin, eventController.updateEvent);
router.delete('/admin/events/:id', ...superAdmin, eventController.deleteEvent);

// --- task submissions ---
// The category list is public so the form can render before anything is sent.
router.get('/submissions/categories', submissionController.listCategories);
router.get('/submissions/mine', requireAuth, submissionController.listMine);
router.post('/submissions', requireAuth, submissionController.createSubmission);
router.delete('/submissions/:id', requireAuth, submissionController.withdraw);

// --- assignments (tasks with a due date) ---
router.get('/assignments', requireAuth, assignmentController.listForLearner);
router.get('/admin/assignments', ...staff, assignmentController.listAll);
router.post('/admin/assignments', ...superAdmin, assignmentController.create);
router.put('/admin/assignments/:id', ...superAdmin, assignmentController.update);
router.delete('/admin/assignments/:id', ...superAdmin, assignmentController.remove);

// --- admin: submission review queue (Support / Reviewer can review) ---
router.get('/admin/submissions', ...staff, submissionController.listAll);
router.patch('/admin/submissions/:id', ...staff, submissionController.review);

// --- certificates ---
// `verify` is public on purpose: a certificate serial is meant to be
// checkable by an employer who has no account here. It is declared before
// the authenticated routes so the more specific path wins.
router.get('/certificates/verify/:serial', certificateController.verify);
router.get('/certificates', requireAuth, certificateController.listMine);
router.post('/certificates/issue', requireAuth, certificateController.issue);
// Sample certificates are an admin-only preview now: POST /admin/certificates/sample.
router.delete('/certificates/:id', requireAuth, certificateController.remove);

// --- enrolment / checkout ---
router.post('/enrollments', requireAuth, enrollmentController.enrol);
router.get('/enrollments/mine', requireAuth, enrollmentController.listMine);

// --- online payment (Razorpay) ---
router.post('/payments/razorpay/order', requireAuth, paymentController.createRazorpayOrder);
router.post('/payments/razorpay/verify', requireAuth, paymentController.verifyRazorpayPayment);
router.post('/payments/razorpay/failed', requireAuth, paymentController.reportRazorpayFailure);
// Public: authenticated by the X-Razorpay-Signature HMAC over the raw body.
router.post('/payments/webhook/razorpay', paymentController.razorpayWebhook);

module.exports = router;
