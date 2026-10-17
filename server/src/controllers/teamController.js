const User = require('../models/User');
const activity = require('../services/activityService');
const { temporaryPassword } = require('./learnerController');

/**
 * Admin team: the staff accounts and their roles.
 *
 *   super_admin — everything
 *   support     — Support / Reviewer: read learners and payments, review
 *                 tasks, view certificates, send notifications
 */

const ROLE_LABEL = { super_admin: 'Super Admin', support: 'Support / Reviewer' };
const normaliseEmail = (value) => String(value || '').trim().toLowerCase();

/** Refuses a change that would leave the platform without an active super admin. */
async function wouldOrphan(member, next) {
  const losingSuper =
    member.staffRole() === 'super_admin' &&
    member.status !== 'suspended' &&
    (next.adminRole === 'support' || next.status === 'suspended');
  if (!losingSuper) return false;

  const supers = await User.find({ role: 'admin', status: { $ne: 'suspended' } });
  return supers.filter((u) => u.staffRole() === 'super_admin').length <= 1;
}

/** GET /api/admin/team */
async function listTeam(_req, res, next) {
  try {
    const team = await User.find({ role: 'admin' }).sort({ createdAt: 1 });
    res.json(team);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/team  body: { name, email, adminRole, password? }
 * Without a password a temporary one is generated and returned once.
 */
async function addMember(req, res, next) {
  try {
    const { name, adminRole } = req.body || {};
    const email = normaliseEmail(req.body?.email);
    if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });
    if (!User.ADMIN_ROLES.includes(adminRole)) return res.status(400).json({ error: 'Choose a role' });
    if (await User.exists({ email })) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    const given = String(req.body?.password || '');
    if (given && given.length < 8) return res.status(400).json({ error: 'Use at least 8 characters for the password' });
    const password = given || temporaryPassword();

    const member = await User.create({
      name: String(name).trim().slice(0, 80),
      email,
      password,
      role: 'admin',
      adminRole,
    });

    await activity.log(req, {
      category: 'team',
      action: 'team.member_added',
      summary: `Added ${member.name} (${member.email}) to the team as ${ROLE_LABEL[adminRole]}`,
      entityType: 'user',
      entityId: member._id,
    });

    res.status(201).json({ member, temporaryPassword: given ? undefined : password });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/admin/team/:id  body: { adminRole?, status? } */
async function updateMember(req, res, next) {
  try {
    const member = await User.findOne({ _id: req.params.id, role: 'admin' });
    if (!member) return res.status(404).json({ error: 'Team member not found' });

    const { adminRole, status } = req.body || {};
    if (adminRole !== undefined && !User.ADMIN_ROLES.includes(adminRole)) {
      return res.status(400).json({ error: 'Unknown role' });
    }
    if (status !== undefined && !['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Unknown status' });
    }
    if (String(member._id) === String(req.user._id)) {
      return res.status(400).json({ error: 'You cannot change your own role or status' });
    }
    if (await wouldOrphan(member, { adminRole, status })) {
      return res.status(400).json({ error: 'There must always be at least one active Super Admin' });
    }

    const changes = [];
    if (adminRole !== undefined && adminRole !== member.staffRole()) {
      changes.push(`role ${ROLE_LABEL[member.staffRole()]} → ${ROLE_LABEL[adminRole]}`);
      member.adminRole = adminRole;
    }
    if (status !== undefined && status !== member.status) {
      changes.push(status === 'suspended' ? 'deactivated' : 're-activated');
      member.status = status;
      member.suspendedAt = status === 'suspended' ? new Date() : undefined;
    }
    if (!changes.length) return res.json(member);

    await member.save();
    await activity.log(req, {
      category: 'team',
      action: 'team.member_updated',
      summary: `${member.name} (${member.email}): ${changes.join(', ')}`,
      entityType: 'user',
      entityId: member._id,
    });

    res.json(member);
  } catch (err) {
    next(err);
  }
}

module.exports = { listTeam, addMember, updateMember, ROLE_LABEL };
