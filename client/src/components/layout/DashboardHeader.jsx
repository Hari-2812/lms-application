import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Award, Bell, CheckCheck, ChevronDown, LayoutGrid, LogOut, Menu, Search, Settings, User } from 'lucide-react';
import Avatar from '../common/Avatar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNotifications } from '../../context/NotificationContext.jsx';

/** "3m ago", "2h ago", "5d ago" — good enough for a notification list. */
function timeAgo(dateString) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const menuItems = [
  { to: '/profile', label: 'Your profile', icon: User },
  { to: '/certificates', label: 'Certificates', icon: Award },
  { to: '/settings', label: 'Settings', icon: Settings },
];

// Prepended for admins, so the dashboard is reachable from any page without
// typing the URL. AdminRoute still guards the route itself.
const adminMenuItem = { to: '/admin', label: 'Admin dashboard', icon: LayoutGrid };

/**
 * Dashboard top bar: contextual greeting on the left, search / notifications
 * / account menu on the right.
 */
export default function DashboardHeader({ title, subtitle, onMenuClick = () => {} }) {
  const { student, signOut } = useAuth();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [query, setQuery] = useState('');
  const menuRef = useRef(null);
  const notifRef = useRef(null);

  useEffect(() => {
    if (!menuOpen && !notifOpen) return undefined;

    const onPointerDown = (event) => {
      if (menuOpen && !menuRef.current?.contains(event.target)) setMenuOpen(false);
      if (notifOpen && !notifRef.current?.contains(event.target)) setNotifOpen(false);
    };
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      setNotifOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen, notifOpen]);

  const onNotificationClick = (notification) => {
    if (!notification.read) markRead(notification.id);
    setNotifOpen(false);

    // `link` is set by whatever raised the notification (and by the admin
    // composer), so a certificate or payment update can land on the right
    // page. Course-only notifications keep their original behaviour.
    if (notification.link) navigate(notification.link);
    else if (notification.courseId) navigate(`/my-courses/${notification.courseId}`);
  };

  const firstName = (student?.name || 'there').split(' ')[0];

  const onSearch = (event) => {
    event.preventDefault();
    navigate(query.trim() ? `/courses?q=${encodeURIComponent(query.trim())}` : '/courses');
  };

  return (
    <header className="sticky top-0 z-30 border-b border-ink-100 bg-white/85 backdrop-blur-md supports-[backdrop-filter]:bg-white/75">
      <div className="flex h-16 items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
          className="rounded-lg p-2.5 text-ink-600 transition hover:bg-ink-50 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Pages that set an explicit title show it at every size. The
            greeting fallback is hidden on mobile, where the page body carries
            it instead and there is no room to show it without truncating. */}
        <div className={`min-w-0 flex-1 ${title ? '' : 'hidden sm:block'}`}>
          <h1 className="truncate text-[15px] font-semibold text-ink-900 sm:text-base">
            {title || `${greeting()}, ${firstName} 👋`}
          </h1>
          <p className="hidden truncate text-xs text-ink-500 sm:block">
            {subtitle || 'Continue your learning journey.'}
          </p>
        </div>

        {!title && <div className="flex-1 sm:hidden" />}

        <form onSubmit={onSearch} role="search" className="hidden xl:block">
          <label htmlFor="dashboard-search" className="sr-only">
            Search courses
          </label>
          <div className="relative w-72">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
              aria-hidden="true"
            />
            <input
              id="dashboard-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search courses…"
              className="w-full rounded-lg border border-ink-200 bg-ink-50/60 py-2 pl-9 pr-3 text-sm
                         transition placeholder:text-ink-400 focus:border-primary-500 focus:bg-white
                         focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
        </form>

        <Link
          to="/courses"
          aria-label="Search courses"
          className="rounded-lg p-2.5 text-ink-500 transition hover:bg-ink-50 hover:text-ink-900 xl:hidden"
        >
          <Search className="h-[18px] w-[18px]" />
        </Link>

        <div ref={notifRef} className="relative">
          <button
            type="button"
            onClick={() => setNotifOpen((v) => !v)}
            aria-label="Notifications"
            aria-expanded={notifOpen}
            aria-haspopup="menu"
            className="relative rounded-lg p-2.5 text-ink-500 transition hover:bg-ink-50 hover:text-ink-900"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-semibold text-white ring-2 ring-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                role="menu"
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] origin-top-right rounded-xl border border-ink-100 bg-white p-1.5 shadow-pop"
              >
                <div className="flex items-center justify-between border-b border-ink-100 px-3 py-2.5">
                  <p className="text-sm font-semibold text-ink-900">Notifications</p>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
                    >
                      <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-ink-500">You're all caught up.</p>
                  ) : (
                    notifications.slice(0, 8).map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        role="menuitem"
                        onClick={() => onNotificationClick(notification)}
                        className={`flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-ink-50 ${
                          notification.read ? '' : 'bg-primary-50/60'
                        }`}
                      >
                        <span className="flex w-full items-center gap-2 font-medium text-ink-900">
                          {!notification.read && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary-600" aria-hidden="true" />
                          )}
                          <span className="truncate">{notification.title}</span>
                        </span>
                        <span className="line-clamp-2 text-xs text-ink-500">{notification.message}</span>
                        <span className="text-[11px] text-ink-400">{timeAgo(notification.createdAt)}</span>
                      </button>
                    ))
                  )}
                </div>

                <div className="border-t border-ink-100 p-1 pt-1.5">
                  <Link
                    to="/notifications"
                    role="menuitem"
                    onClick={() => setNotifOpen(false)}
                    className="block rounded-lg px-3 py-2 text-center text-[13px] font-semibold text-primary-700 transition hover:bg-primary-50"
                  >
                    View all notifications
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex items-center gap-2 rounded-lg p-1 pr-2 transition hover:bg-ink-50"
          >
            <Avatar name={student?.name} src={student?.avatar} size="sm" />
            <span className="hidden text-left leading-tight sm:block">
              <span className="block max-w-[10rem] truncate text-[13px] font-semibold text-ink-900">
                {student?.name}
              </span>
              <span className="block max-w-[10rem] truncate text-[11px] text-ink-500">
                {student?.email}
              </span>
            </span>
            <ChevronDown
              className={`hidden h-4 w-4 text-ink-400 transition sm:block ${menuOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                role="menu"
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                className="absolute right-0 top-full mt-2 w-60 origin-top-right rounded-xl border border-ink-100 bg-white p-1.5 shadow-pop"
              >
                <div className="border-b border-ink-100 px-3 py-2.5">
                  <p className="truncate text-sm font-semibold text-ink-900">{student?.name}</p>
                  <p className="truncate text-xs text-ink-500">{student?.email}</p>
                </div>

                {(student?.role === 'admin' ? [adminMenuItem, ...menuItems] : menuItems).map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-ink-700 transition hover:bg-ink-50"
                  >
                    <Icon className="h-4 w-4 text-ink-400" aria-hidden="true" />
                    {label}
                  </Link>
                ))}

                <button
                  type="button"
                  role="menuitem"
                  onClick={signOut}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Log out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
