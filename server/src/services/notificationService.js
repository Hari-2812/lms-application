const Notification = require('../models/Notification');
const { emitToUser } = require('./socketService');

/** Creates + emits a notification to a single user. */
async function notifyUser(userId, { type, title, message, courseId }) {
  const notification = await Notification.create({ userId, type, title, message, courseId });
  emitToUser(userId, notification.toJSON());
  return notification;
}

/** Creates + emits the same notification to a list of users. */
async function notifyUsers(userIds, { type, title, message, courseId }) {
  if (!userIds.length) return [];
  const docs = await Notification.insertMany(
    userIds.map((userId) => ({ userId, type, title, message, courseId }))
  );
  docs.forEach((doc) => emitToUser(doc.userId, doc.toJSON()));
  return docs;
}

module.exports = { notifyUser, notifyUsers };
