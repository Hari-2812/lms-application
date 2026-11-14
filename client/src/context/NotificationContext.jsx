import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  API_ORIGIN,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  setAuthToken,
} from '../api/client';
import { useAuth } from './AuthContext.jsx';

/**
 * Real-time notification feed: connects a Socket.IO client once the student
 * is signed in, seeds the list from GET /api/notifications, and prepends
 * anything the server pushes afterwards. Swallows connection errors — a
 * missed real-time event never breaks the rest of the app.
 *
 * Notifications are stored on the server, so the live socket is only a
 * shortcut. Whenever the connection comes back (a reconnect, the network
 * returning, the tab being shown again) the list is re-read, so anything sent
 * while disconnected still appears.
 */

const NotificationContext = createContext(null);

/** Matches PAGE_SIZE in the server's notificationController. */
const PAGE_SIZE = 20;

/** Retry delays after the server refused the socket handshake (not an auth failure). */
const HANDSHAKE_RETRY_MS = { first: 5000, max: 60000 };

/** The newest page from the server, followed by older ones already loaded. */
function mergeLatest(previous, latest) {
  const seen = new Set(latest.map((n) => n.id));
  return [...latest, ...previous.filter((n) => !seen.has(n.id))];
}

export function NotificationProvider({ children }) {
  const { isAuthenticated, token } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  // The API pages 20 at a time; history pages call loadMore for older ones.
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const socketRef = useRef(null);
  // The current list, readable from the socket handler without re-subscribing.
  const notificationsRef = useRef([]);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setNotifications([]);
      setUnreadCount(0);
      setHasMore(false);
      return undefined;
    }

    // AuthContext also sets this, but its own rehydration effect can fire
    // after this one on first mount — set it here too so the very first
    // request always carries the token instead of racing to a 401.
    setAuthToken(token);

    let disposed = false;
    let loadedOnce = false;

    /** Reads the newest page; merges it in after the first load. */
    const refresh = () =>
      getNotifications()
        .then((data) => {
          if (disposed) return;
          const latest = data.notifications || [];
          setNotifications((prev) => (loadedOnce ? mergeLatest(prev, latest) : latest));
          setUnreadCount(data.unreadCount || 0);
          if (!loadedOnce) setHasMore(latest.length >= PAGE_SIZE);
          loadedOnce = true;
        })
        .catch(() => {
          /* the bell just stays as it is until the next successful fetch */
        });

    refresh();

    const socket = io(API_ORIGIN || undefined, {
      auth: { token },
      // Keep trying through a long outage (a server restart, a dead network)
      // without hammering the server: 1s, 2s, 4s… up to 10s between attempts.
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
    socketRef.current = socket;

    let connectedBefore = false;
    let retryTimer = null;
    let retryDelay = HANDSHAKE_RETRY_MS.first;

    socket.on('connect', () => {
      retryDelay = HANDSHAKE_RETRY_MS.first;
      // Back after a drop: pick up whatever was sent in the meantime.
      if (connectedBefore) refresh();
      connectedBefore = true;
    });

    socket.on('connect_error', (err) => {
      // A temporary failure: Socket.IO keeps retrying on its own.
      if (socket.active) return;
      // The server refused the handshake. A bad session is dealt with by the
      // API's 401 (which signs the learner out); anything else — the server was
      // busy or briefly lost its database — is worth trying again. Socket.IO
      // does not retry a refused handshake by itself.
      if (err?.data?.code === 'AUTH_FAILED') return;
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        if (!disposed) socket.connect();
      }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, HANDSHAKE_RETRY_MS.max);
    });

    socket.on('notification', (notification) => {
      // A catch-up refresh may already have brought this one in.
      if (notificationsRef.current.some((n) => n.id === notification.id)) return;
      setNotifications((prev) => (prev.some((n) => n.id === notification.id) ? prev : [notification, ...prev]));
      setUnreadCount((prev) => prev + 1);
    });

    // The network came back, or the learner returned to the tab: reconnect
    // straight away rather than waiting for the next backoff step.
    const resume = () => {
      if (disposed) return;
      if (!socket.connected) socket.connect();
      refresh();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !socket.connected) resume();
    };
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', onVisibility);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, token]);

  const markRead = useCallback((id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    markNotificationRead(id).catch(() => {});
  }, []);

  const loadMore = useCallback(async () => {
    const oldest = notifications[notifications.length - 1];
    if (!oldest || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await getNotifications(oldest.createdAt);
      const older = data.notifications || [];
      setNotifications((prev) => {
        const seen = new Set(prev.map((n) => n.id));
        return [...prev, ...older.filter((n) => !seen.has(n.id))];
      });
      setHasMore(older.length >= PAGE_SIZE);
    } catch {
      /* leave the button in place to try again */
    } finally {
      setLoadingMore(false);
    }
  }, [notifications, loadingMore]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    markAllNotificationsRead().catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ notifications, unreadCount, markRead, markAllRead, loadMore, hasMore, loadingMore }),
    [notifications, unreadCount, markRead, markAllRead, loadMore, hasMore, loadingMore]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationProvider>');
  return ctx;
}
