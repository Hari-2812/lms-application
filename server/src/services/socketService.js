const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const User = require('../models/User');
const { rejectionFor } = require('../middleware/authMiddleware');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-key-change-in-prod';

let io = null;

function userRoom(userId) {
  return `user:${userId}`;
}

/** Attaches Socket.IO to the same HTTP server Express listens on. */
function initSocket(httpServer, isOriginAllowed) {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => callback(null, isOriginAllowed(origin)),
    },
  });

  /**
   * Handshake auth. The error's `data.code` tells the client what to do:
   *   AUTH_FAILED   the session is not valid — do not retry
   *   SERVER_ERROR  we could not check it right now (database busy) — retry
   * Socket.IO never retries a refused handshake by itself, so treating a
   * database hiccup as a bad token used to leave real-time notifications off
   * until the page was reloaded.
   */
  io.use(async (socket, next) => {
    const refuse = (message, code) => {
      const err = new Error(message);
      err.data = { code };
      next(err);
    };

    const token = socket.handshake.auth?.token;
    if (!token) return refuse('No token provided', 'AUTH_FAILED');

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return refuse('Invalid or expired token', 'AUTH_FAILED');
    }

    try {
      const user = await User.findById(decoded.id);
      if (!user) return refuse('User no longer exists', 'AUTH_FAILED');
      // Same rules as the REST API: suspended, or signed out by a password change.
      const rejection = rejectionFor(user, decoded);
      if (rejection) return refuse(rejection, 'AUTH_FAILED');

      socket.userId = String(user._id);
      next();
    } catch (err) {
      console.error('[socket] could not check the session:', err.message);
      refuse('The server is busy, please retry', 'SERVER_ERROR');
    }
  });

  io.on('connection', (socket) => {
    socket.join(userRoom(socket.userId));
  });

  return io;
}

/** Emits `notification` with the given payload to a single user, if connected. */
function emitToUser(userId, payload) {
  if (!io) return;
  io.to(userRoom(userId)).emit('notification', payload);
}

/** Emits `notification` with the same payload to a list of users. */
function emitToUsers(userIds, payload) {
  if (!io) return;
  io.to(userIds.map(userRoom)).emit('notification', payload);
}

/** Emits `notification` to every connected user. */
function emitToAll(payload) {
  if (!io) return;
  io.emit('notification', payload);
}

module.exports = { initSocket, emitToUser, emitToUsers, emitToAll };
