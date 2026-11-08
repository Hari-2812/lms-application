const Notification = require('../models/Notification');
const User = require('../models/User');
const { emitToUser } = require('./socketService');
const settingsService = require('./settingsService');
const mailService = require('./mailService');

/**
 * Creates notifications, pushes them over Socket.IO and, when Settings →
 * Email has "notification copies" on, emails them too.
 *
 * Automatic notifications pass a `setting` option naming the switch that
 * controls them (Settings → Notifications), e.g. { setting: 'learner.newCourse' }.
 * When that switch is off nothing is created. Notifications an admin
 * composes by hand pass no setting and always go out.
 */

async function allowed(setting) {
  if (!setting) return true;
  const [audience, key] = setting.split('.');
  return settingsService.isNotificationEnabled(audience, key);
}

/** Fire-and-forget email copies; never delays or fails the notification itself. */
async function emailCopies(userIds, { title, message }) {
  try {
    const { email } = await settingsService.get();
    if (!email.notificationCopies || !userIds.length) return;

    const users = await User.find({ _id: { $in: userIds }, status: { $ne: 'suspended' } }).select('email');
    // Batched with Resend, so a notice to every learner stays within its rate limit.
    await mailService.sendMany(users.filter((u) => u.email).map((u) => ({ to: u.email, subject: title, text: message })));
  } catch (err) {
    console.error('[notify] email copies failed:', err.message);
  }
}

/** Creates + emits a notification to a single user. */
async function notifyUser(userId, { type, title, message, courseId, link }, { setting } = {}) {
  if (!userId || !(await allowed(setting))) return null;
  const notification = await Notification.create({ userId, type, title, message, courseId, link });
  emitToUser(userId, notification.toJSON());
  emailCopies([userId], { title, message });
  return notification;
}

/** Creates + emits the same notification to a list of users. */
async function notifyUsers(userIds, { type, title, message, courseId, link }, { setting } = {}) {
  if (!userIds.length || !(await allowed(setting))) return [];
  const docs = await Notification.insertMany(
    userIds.map((userId) => ({ userId, type, title, message, courseId, link }))
  );
  docs.forEach((doc) => emitToUser(doc.userId, doc.toJSON()));
  emailCopies(userIds, { title, message });
  return docs;
}

/**
 * Notifies every active staff account — things the admin team should know
 * about or act on. `exclude` skips the admin whose own action caused it.
 */
async function notifyAdmins(payload, { setting, exclude } = {}) {
  const filter = { role: 'admin', status: { $ne: 'suspended' } };
  if (exclude) filter._id = { $ne: exclude };
  const admins = await User.find(filter).select('_id');
  return notifyUsers(admins.map((a) => a._id), payload, { setting });
}

/** Every learner account that can currently sign in. */
async function activeLearnerIds(extraFilter = {}) {
  // $ne (not $eq 'student') also matches accounts created before the role
  // field existed, which never got it persisted to their stored document.
  const learners = await User.find({ role: { $ne: 'admin' }, status: { $ne: 'suspended' }, ...extraFilter }).select('_id');
  return learners.map((u) => u._id);
}

module.exports = { notifyUser, notifyUsers, notifyAdmins, activeLearnerIds };
