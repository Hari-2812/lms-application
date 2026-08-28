import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Award, Bell, ChevronDown, LogOut, Menu, Search, Settings, User } from 'lucide-react';
import Avatar from '../common/Avatar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

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

/**
 * Dashboard top bar: contextual greeting on the left, search / notifications
 * / account menu on the right.
 */
export default function DashboardHeader({ title, subtitle, onMenuClick = () => {} }) {
  const { student, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const onPointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const onKey = (event) => event.key === 'Escape' && setMenuOpen(false);

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

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

        <Link
          to="/achievements"
          aria-label="Notifications"
          className="relative rounded-lg p-2.5 text-ink-500 transition hover:bg-ink-50 hover:text-ink-900"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary-600 ring-2 ring-white" />
        </Link>

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

                {menuItems.map(({ to, label, icon: Icon }) => (
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
