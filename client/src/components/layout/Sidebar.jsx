import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Award,
  BookOpen,
  Compass,
  FileText,
  Heart,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Medal,
  Settings,
  ShieldCheck,
  TrendingUp,
  User,
  X,
} from 'lucide-react';
import Logo from '../common/Logo.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useWishlist from '../../hooks/useWishlist.js';

const primaryLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/my-courses', label: 'My Courses', icon: BookOpen },
  { to: '/courses', label: 'Browse Courses', icon: Compass },
  { to: '/resources', label: 'Resources', icon: FileText },
  { to: '/wishlist', label: 'Wishlist', icon: Heart, badge: 'wishlist' },
  { to: '/certificates', label: 'Certificates', icon: Award },
  { to: '/achievements', label: 'Achievements', icon: Medal },
  { to: '/progress', label: 'Progress', icon: TrendingUp },
];

const accountLinks = [
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function Nav({ onNavigate, onClose }) {
  const { signOut } = useAuth();
  const { count } = useWishlist();

  const renderLink = ({ to, label, icon: Icon, badge }) => (
    <NavLink
      key={to}
      to={to}
      onClick={onNavigate}
      className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      <span className="flex-1">{label}</span>
      {badge === 'wishlist' && count > 0 && (
        <span className="rounded-md bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-ink-600">
          {count}
        </span>
      )}
    </NavLink>
  );

  return (
    <>
      <div className="flex h-16 shrink-0 items-center border-b border-ink-100 px-5">
        <Logo />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="ml-auto rounded-lg p-2 text-ink-500 transition hover:bg-ink-50 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav aria-label="Dashboard" className="scrollbar-slim flex-1 overflow-y-auto p-3">
        <p className="px-3 pb-2 pt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
          Learning
        </p>
        <div className="space-y-0.5">{primaryLinks.map(renderLink)}</div>

        <p className="px-3 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
          Account
        </p>
        <div className="space-y-0.5">{accountLinks.map(renderLink)}</div>
      </nav>

      <div className="shrink-0 space-y-0.5 border-t border-ink-100 p-3">
        <NavLink
          to="/how-it-works"
          onClick={onNavigate}
          className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
        >
          <ShieldCheck className="h-[18px] w-[18px]" aria-hidden="true" />
          How It Works
        </NavLink>
        <a href="mailto:support@analyticsavenue.example" className="sidebar-link">
          <LifeBuoy className="h-[18px] w-[18px]" aria-hidden="true" />
          Help &amp; Support
        </a>
        <button
          type="button"
          onClick={signOut}
          className="sidebar-link w-full text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
          Log out
        </button>
      </div>
    </>
  );
}

export default function Sidebar({ isMobileOpen = false, onClose = () => {} }) {
  return (
    <>
      {/* Desktop: a permanent column. */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-100 bg-white lg:flex">
        <div className="sticky top-0 flex h-screen flex-col">
          <Nav />
        </div>
      </aside>

      {/* Mobile: a drawer. Kept mounted so the transition can run both ways. */}
      <div
        className={`fixed inset-0 z-50 lg:hidden ${isMobileOpen ? '' : 'pointer-events-none'}`}
        aria-hidden={!isMobileOpen}
      >
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
          className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-pop"
        >
          <Nav onNavigate={onClose} onClose={onClose} />
        </motion.aside>
      </div>
    </>
  );
}
