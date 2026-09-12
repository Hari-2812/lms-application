const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-key-change-in-prod';
const ADMIN_EMAIL = 'vasanthkumar5151@gmail.com';

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Fetch fresh user from DB to ensure they still exist
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User no longer exists' });
    }

    req.user = user;
    
    // Also attach to req.student for backwards compatibility with existing mock auth endpoints
    req.student = user;
    
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    next(err);
  }
}

/**
 * Like requireAuth, but never rejects: attaches req.user when a valid token
 * is present and simply leaves it undefined otherwise. Lets public pages
 * (the course catalogue) stay browsable while still returning per-student
 * access/progress info to whoever happens to be signed in.
 */
async function optionalAuth(req, _res, next) {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query.token) {
      token = req.query.token;
    }

    if (!token) return next();

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (user) {
      req.user = user;
      req.student = user;
    }
    next();
  } catch (err) {
    // An invalid/expired token on a public route just means "browse as a guest".
    next();
  }
}

function requireAdmin(req, res, next) {
  // Must be called AFTER requireAuth
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireAdmin,
  ADMIN_EMAIL,
};
