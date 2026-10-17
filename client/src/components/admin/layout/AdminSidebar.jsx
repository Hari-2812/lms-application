import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Award,
  Bell,
  BookOpen,
  CalendarClock,
  ClipboardCheck,
  CreditCard,
  History,
  LayoutDashboard,
  LogOut,
  MonitorPlay,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import Logo from '../../common/Logo.jsx';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useNotifications } from '../../../context/NotificationContext.jsx';

/**
 * The admin panel's own navigation — a deep blue column, so it is never
 * confused with the learner dashboard. Super-admin-only sections are hidden
 * from Support / Reviewer accounts (the server enforces the same split).
 */

const GROUPS = [
  {
    label: 'Overview',
    links: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    label: 'People & money',
    links: [
      { to: '/admin/learners', label: 'Learners', icon: Users },
      { to: '/admin/payments', label: 'Payments', icon: CreditCard },
    ],
  },
  {
    label: 'Learning',
    links: [
      { to: '/admin/courses', label: 'Courses', icon: BookOpen, superOnly: true },
      { to: '/admin/tasks', label: 'Tasks & reviews', icon: ClipboardCheck },
      { to: '/admin/events', label: 'Events', icon: CalendarClock, superOnly: true },
      { to: '/admin/certificates', label: 'Certificates', icon: Award },
    ],
  },
  {
    label: 'Communication',
    links: [{ to: '/admin/notifications', label: 'Notifications', icon: Bell, badge: true }],
  },
  {
    label: 'Administration',
    superOnly: true,
    links: [
      { to: '/admin/settings', label: 'LMS settings', icon: Settings },
      { to: '/admin/team', label: 'Team & roles', icon: ShieldCheck },
      { to: '/admin/activity', label: 'Activity log', icon: History },
    ],
  },
];

function Nav({ onNavigate, onClose }) {
  const { signOut, isSuperAdmin } = useAuth();
  const { unreadCount } = useNotifications();

  const link = ({ to, label, icon: Icon, end, badge }) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) => `admin-sidebar-link ${isActive ? 'admin-sidebar-link-active' : ''}`}
    >
      {({ isActive }) => (
        <>
          <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          <span className="flex-1">{label}</span>
          {badge && unreadCount > 0 && (
            <span
              className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary-800"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </>
      )}
    </NavLink>
  );

  return (
    <>
      <div className="flex h-16 shrink-0 items-center border-b border-white/10 px-5">
        <Logo to="/admin" tone="light" />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="ml-auto rounded-lg p-2 text-primary-100 transition hover:bg-white/10 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav aria-label="Admin" className="scrollbar-none flex-1 overflow-y-auto px-3 py-4">
        {GROUPS.filter((g) => !g.superOnly || isSuperAdmin).map((group) => {
          const links = group.links.filter((l) => !l.superOnly || isSuperAdmin);
          if (!links.length) return null;
          return (
            <div key={group.label} className="mb-4">
              <p className="px-3 pb-1.5 text-[11px] font-medium text-primary-300">
                {group.label}
              </p>
              <div className="space-y-0.5">{links.map(link)}</div>
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 space-y-1 border-t border-white/10 p-3">
        <NavLink
          to="/admin/account"
          onClick={onNavigate}
          className={({ isActive }) => `admin-sidebar-link ${isActive ? 'admin-sidebar-link-active' : ''}`}
        >
          <UserCog className="h-[18px] w-[18px]" aria-hidden="true" />
          My account
        </NavLink>
        <NavLink to="/dashboard" onClick={onNavigate} className="admin-sidebar-link">
          <MonitorPlay className="h-[18px] w-[18px]" aria-hidden="true" />
          Learner view
        </NavLink>
        <button type="button" onClick={signOut} className="admin-sidebar-link w-full text-red-200 hover:bg-red-500/20 hover:text-white">
          <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
          Log out
        </button>
      </div>
    </>
  );
}

const shell = 'flex flex-col bg-primary-800';

export default function AdminSidebar({ isMobileOpen = false, onClose = () => {} }) {
  return (
    <>
      <aside className={`hidden w-64 shrink-0 lg:flex ${shell}`}>
        <div className="sticky top-0 flex h-screen w-full flex-col">
          <Nav />
        </div>
      </aside>

      <div className={`fixed inset-0 z-50 lg:hidden ${isMobileOpen ? '' : 'pointer-events-none'}`} aria-hidden={!isMobileOpen}>
        <div
          onClick={onClose}
          className={`absolute inset-0 bg-ink-950/50 backdrop-blur-sm transition-opacity duration-200 ${
            isMobileOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <motion.aside
          initial={false}
          animate={{ x: isMobileOpen ? 0 : '-100%' }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className={`absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-pop ${shell}`}
        >
          <Nav onNavigate={onClose} onClose={onClose} />
        </motion.aside>
      </div>
    </>
  );
}
