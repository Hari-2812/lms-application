const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const User = require('../models/User');

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

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('No token provided'));

      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user) return next(new Error('User no longer exists'));
      if (user.status === 'suspended') return next(new Error('Account suspended'));

      socket.userId = String(user._id);
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
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
