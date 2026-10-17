const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const activity = require('../services/activityService');
const mailService = require('../services/mailService');
const settingsService = require('../services/settingsService');
const { notifyAdmins } = require('../services/notificationService');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-key-change-in-prod';
const JWT_EXPIRES_IN = '7d';

// Five wrong passwords lock the account for fifteen minutes.
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const RESET_TOKEN_MINUTES = 60;
const MIN_PASSWORD_LENGTH = 8;

function generateToken(user) {
  return jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

const normaliseEmail = (value) => String(value || '').trim().toLowerCase();
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

/**
 * The frontend origin used in emailed links. Taken from configuration and
 * never from the request: an Origin/Host header is attacker-controlled, and
 * trusting it would let anyone have a reset link pointed at their own site.
 */
function appUrl() {
  const configured = (process.env.APP_URL || process.env.CLIENT_URL || '').split(',')[0].trim();
  return (configured || 'http://localhost:5173').replace(/\/$/, '');
}

async function register(req, res, next) {
  try {
    const { name, password, phone } = req.body || {};
    const email = normaliseEmail(req.body?.email);

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    if (String(password).length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Use at least ${MIN_PASSWORD_LENGTH} characters for your password` });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    // Only name/email/password/phone are taken from the body — never `role`.
    const user = new User({
      name: String(name).trim().slice(0, 80),
      email,
      password,
      phone: String(phone || '').trim().slice(0, 20),
      lastLoginAt: new Date(),
    });
    await user.save();

    await notifyAdmins(
      {
        type: 'learner_registered',
        title: 'New learner registered',
        message: `${user.name} (${user.email}) just created an account.`,
        link: `/admin/learners/${user._id}`,
      },
      { setting: 'admin.learnerRegistered' }
    );

    const token = generateToken(user);
    res.status(201).json({ student: user, token });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const email = normaliseEmail(req.body?.email);
    const { password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.lockUntil && user.lockUntil > new Date()) {
      const minutes = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(429).json({
        error: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or reset your password.`,
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= MAX_FAILED_LOGINS) {
        user.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60000);
        user.failedLoginAttempts = 0;
        if (user.role === 'admin') {
          await activity.log(
            { user, ip: req.ip },
            {
              category: 'security',
              action: 'auth.locked',
              summary: `Admin account ${user.email} locked after ${MAX_FAILED_LOGINS} failed sign-in attempts`,
              entityType: 'user',
              entityId: user._id,
            }
          );
        }
      }
      await user.save();
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Checked after the password so a suspended account's existence is not
    // revealed to someone guessing.
    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Your account is suspended. Please contact support.' });
    }

    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLoginAt = new Date();
    await user.save();

    if (user.role === 'admin') {
      await activity.log(
        { user, ip: req.ip },
        {
          category: 'security',
          action: 'auth.admin_login',
          summary: `${user.name} signed in to the admin panel`,
          entityType: 'user',
          entityId: user._id,
        }
      );
    }

    const token = generateToken(user);
    res.json({ student: user, token });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    // req.user will be attached by authMiddleware
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json(req.user);
  } catch (err) {
    next(err);
  }
}

/** PUT /api/me — the profile fields a user may change about themselves. */
async function updateMe(req, res, next) {
  try {
    const body = req.body || {};
    const limits = { name: 80, phone: 20, city: 80, headline: 120, bio: 1000 };

    for (const [field, max] of Object.entries(limits)) {
      if (body[field] === undefined) continue;
      const value = String(body[field]).trim().slice(0, max);
      if (field === 'name' && !value) return res.status(400).json({ error: 'Name cannot be empty' });
      req.user[field] = value;
    }

    await req.user.save();
    res.json(req.user);
  } catch (err) {
    next(err);
  }
}

/** PUT /api/me/password  body: { currentPassword, newPassword } */
async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Enter your current and new password' });
    }
    if (String(newPassword).length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Use at least ${MIN_PASSWORD_LENGTH} characters` });
    }
    if (!(await req.user.comparePassword(currentPassword))) {
      return res.status(400).json({ error: 'Your current password is not correct' });
    }

    req.user.password = newPassword;
    await req.user.save();

    await activity.log(req, {
      category: 'security',
      action: 'auth.password_changed',
      summary: `${req.user.name} changed their password`,
      entityType: 'user',
      entityId: req.user._id,
    });

    // The change revokes older tokens, this one included — hand back a fresh
    // one so the session that made the change stays signed in.
    res.json({ success: true, token: generateToken(req.user) });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/forgot-password  body: { email }
 *
 * Always answers the same way, so it cannot be used to find out which
 * addresses have accounts. Without SMTP the link is printed to the server
 * console (see mailService).
 */
async function forgotPassword(req, res, next) {
  try {
    const email = normaliseEmail(req.body?.email);
    if (!email) return res.status(400).json({ error: 'Enter your email address' });

    const generic = {
      success: true,
      message: 'If an account exists for that email, a password reset link is on its way.',
    };

    const user = await User.findOne({ email });
    if (!user || user.status === 'suspended') return res.json(generic);

    // At most one email a minute per account.
    const issuedAt = user.resetPasswordExpires
      ? user.resetPasswordExpires.getTime() - RESET_TOKEN_MINUTES * 60000
      : 0;
    if (Date.now() - issuedAt < 60000) return res.json(generic);

    await sendResetLink(user);
    res.json(generic);
  } catch (err) {
    next(err);
  }
}

/**
 * Issues a fresh single-use reset token and emails the link. Shared by the
 * public "forgot password" form and the admin "send reset link" action.
 * Resolves mailService's { sent, error }.
 */
async function sendResetLink(user) {
  const token = crypto.randomBytes(32).toString('hex');
  user.resetPasswordTokenHash = sha256(token);
  user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_MINUTES * 60000);
  await user.save();

  const { branding } = await settingsService.get();
  const url = `${appUrl()}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;

  return mailService.sendMail({
    to: user.email,
    subject: `Reset your ${branding.platformName} password`,
    text:
      `Hi ${user.name},\n\nUse this link to choose a new password. It works once and expires in ` +
      `${RESET_TOKEN_MINUTES} minutes:\n\n${url}\n\nIf you did not ask for this, you can ignore this email.`,
    html:
      `<p>Hi ${escapeHtml(user.name)},</p><p>Use the button below to choose a new password. ` +
      `It works once and expires in ${RESET_TOKEN_MINUTES} minutes.</p>` +
      `<p><a href="${url}" style="display:inline-block;padding:10px 18px;background:#2450eb;color:#fff;` +
      `border-radius:8px;text-decoration:none">Reset password</a></p>` +
      `<p style="color:#64748b">If you did not ask for this, you can ignore this email.</p>`,
  });
}

/** POST /api/auth/reset-password  body: { email, token, password } */
async function resetPassword(req, res, next) {
  try {
    const email = normaliseEmail(req.body?.email);
    const { token, password } = req.body || {};
    const invalid = { error: 'This reset link is invalid or has expired. Request a new one.' };

    if (!email || !token) return res.status(400).json(invalid);
    if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Use at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    const user = await User.findOne({ email });
    if (
      !user ||
      !user.resetPasswordTokenHash ||
      !user.resetPasswordExpires ||
      user.resetPasswordExpires < new Date() ||
      user.resetPasswordTokenHash !== sha256(String(token))
    ) {
      return res.status(400).json(invalid);
    }

    user.password = password;
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpires = undefined;
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    await activity.log(
      { user, ip: req.ip },
      {
        category: 'security',
        action: 'auth.password_reset',
        summary: `${user.name} reset their password with an emailed link`,
        entityType: 'user',
        entityId: user._id,
      }
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

async function logout(req, res) {
  // Real stateless JWTs can't be easily invalidated server-side without a blocklist.
  // We rely on the client to delete the token.
  res.json({ success: true, message: 'Logged out successfully' });
}

module.exports = {
  register,
  login,
  getMe,
  updateMe,
  changePassword,
  forgotPassword,
  resetPassword,
  sendResetLink,
  logout,
  generateToken,
  MIN_PASSWORD_LENGTH,
};
