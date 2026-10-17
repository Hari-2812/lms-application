const ActivityLog = require('../models/ActivityLog');

/**
 * Records a key change in the activity log.
 *
 * Never throws: an audit write that fails must not undo or fail the change
 * it describes. Failures are logged to the console instead.
 *
 *   log(req, { category, action, summary, entityType?, entityId?, meta? })
 *
 * `req` supplies the actor (req.user) and IP; pass null for system events.
 */
async function log(req, { category, action, summary, entityType = '', entityId = '', meta }) {
  try {
    const actor = req?.user;
    await ActivityLog.create({
      actorId: actor?._id,
      actorName: actor?.name || 'System',
      actorEmail: actor?.email || '',
      category,
      action,
      summary,
      entityType,
      entityId: entityId ? String(entityId) : '',
      meta,
      ip: req?.ip || '',
    });
  } catch (err) {
    console.error('[activity] could not record', action, '-', err.message);
  }
}

module.exports = { log };
