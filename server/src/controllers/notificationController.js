const Notification = require('../models/Notification');

const PAGE_SIZE = 20;

/** GET /api/notifications?cursor=<createdAt ISO> */
async function listNotifications(req, res, next) {
  try {
    const { cursor } = req.query;
    const filter = { userId: req.user._id };
    if (cursor) filter.createdAt = { $lt: new Date(cursor) };

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).limit(PAGE_SIZE),
      Notification.countDocuments({ userId: req.user._id, read: false }),
    ]);

    res.json({ notifications, unreadCount });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/notifications/:id/read */
async function markRead(req, res, next) {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { read: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json(notification);
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/notifications/read-all */
async function markAllRead(req, res, next) {
  try {
    await Notification.updateMany({ userId: req.user._id, read: false }, { read: true });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { listNotifications, markRead, markAllRead };
