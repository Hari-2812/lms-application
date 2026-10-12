const Notification = require('../models/Notification');
const User = require('../models/User');
const { emitToUser } = require('./socketService');

/** Creates + emits a notification to a single user. */
async function notifyUser(userId, { type, title, message, courseId, link }) {
  const notification = await Notification.create({ userId, type, title, message, courseId, link });
  emitToUser(userId, notification.toJSON());
  return notification;
}

/** Creates + emits the same notification to a list of users. */
async function notifyUsers(userIds, { type, title, message, courseId, link }) {
  if (!userIds.length) return [];
  const docs = await Notification.insertMany(
    userIds.map((userId) => ({ userId, type, title, message, courseId, link }))
  );
  docs.forEach((doc) => emitToUser(doc.userId, doc.toJSON()));
  return docs;
}

/**
 * Notifies every admin account. Used for things the admin team has to act on
 * — a pending enrolment payment being the main one.
 */
async function notifyAdmins(payload) {
  const admins = await User.find({ role: 'admin' }).select('_id');
  return notifyUsers(admins.map((a) => a._id), payload);
}

module.exports = { notifyUser, notifyUsers, notifyAdmins };
