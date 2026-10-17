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
 */

const NotificationContext = createContext(null);

/** Matches PAGE_SIZE in the server's notificationController. */
const PAGE_SIZE = 20;

export function NotificationProvider({ children }) {
  const { isAuthenticated, token } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  // The API pages 20 at a time; history pages call loadMore for older ones.
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const socketRef = useRef(null);

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

    getNotifications()
      .then((data) => {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
        setHasMore((data.notifications || []).length >= PAGE_SIZE);
      })
      .catch(() => {
        /* the bell just stays empty until the next successful fetch */
      });

    const socket = io(API_ORIGIN || undefined, { auth: { token } });
    socketRef.current = socket;

    socket.on('notification', (notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);
    });

    return () => {
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
