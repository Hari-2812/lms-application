import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutDashboard, Menu, Search, X } from 'lucide-react';
import Button from '../common/Button.jsx';
import Logo from '../common/Logo.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/courses', label: 'Courses' },
  { to: '/courses?view=categories', label: 'Categories' },
  { to: '/#about', label: 'About' },
  { to: '/#contact', label: 'Contact' },
];

/**
 * Sticky public header. Compacts and gains a blurred background once the
 * page scrolls, and collapses into a drawer below `lg`.
 */
export default function PublicNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [location.pathname, location.hash]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const isHashLink = (to) => to.includes('#');

  return (
    <header
      className={`sticky top-0 z-40 border-b transition-all duration-300 ease-out ${
        scrolled
          ? 'border-ink-100 bg-white/85 backdrop-blur-md supports-[backdrop-filter]:bg-white/70'
          : 'border-transparent bg-white'
      }`}
    >
      <div
        className={`container flex items-center gap-3 transition-all duration-300 lg:gap-8 ${
          scrolled ? 'h-14' : 'h-16 lg:h-[4.5rem]'
        }`}
      >
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {links.map((link) =>
            isHashLink(link.to) ? (
              <a
                key={link.to}
                href={link.to}
                className="rounded-lg px-3 py-2 text-sm font-medium text-ink-600 transition hover:bg-ink-50 hover:text-ink-900"
              >
                {link.label}
              </a>
            ) : (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-ink-50 hover:text-ink-900 ${
                    isActive ? 'text-primary-700' : 'text-ink-600'
                  }`
                }
              >
                {link.label}
              </NavLink>
            )
          )}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-3">
          <Link
            to="/courses"
            aria-label="Search courses"
            className="hidden rounded-lg p-2.5 text-ink-500 transition hover:bg-ink-50 hover:text-ink-900 sm:block"
          >
            <Search className="h-[18px] w-[18px]" />
          </Link>

          {isAuthenticated ? (
            <Button to="/dashboard" size="sm">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Button>
          ) : (
            <>
              <Button to="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
                Login
              </Button>
              <Button to="/register" size="sm">
                Get Started
              </Button>
            </>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className="rounded-lg p-2.5 text-ink-600 transition hover:bg-ink-50 lg:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            id="mobile-nav"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-ink-100 bg-white lg:hidden"
          >
            <nav aria-label="Mobile" className="container flex flex-col gap-1 py-4">
              {links.map((link) =>
                isHashLink(link.to) ? (
                  <a
                    key={link.to}
                    href={link.to}
                    onClick={() => setMenuOpen(false)}
                    className="rounded-lg px-3 py-3 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
                  >
                    {link.label}
                  </a>
                ) : (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) =>
                      `rounded-lg px-3 py-3 text-sm font-medium transition hover:bg-ink-50 ${
                        isActive ? 'bg-primary-50 text-primary-700' : 'text-ink-700'
                      }`
                    }
                  >
                    {link.label}
                  </NavLink>
                )
              )}

              {!isAuthenticated && (
                <Button to="/login" variant="secondary" fullWidth className="mt-3 sm:hidden">
                  Login
                </Button>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
