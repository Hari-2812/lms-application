import { Link } from 'react-router-dom';

/**
 * The Analytics Avenue logo. Fixed: not editable from the admin panel.
 * All three files are cut from the same artwork (public/logos):
 *   full     icon + name + "Building Smarter Teams with AI & L&D"
 *   compact  icon + name, for bars where the tagline would be too small to read
 *   mark     the icon alone
 */
export const LOGO_FULL_SRC = '/logos/analytics-avenue-full.png';
export const LOGO_COMPACT_SRC = '/logos/analytics-avenue-compact.png';
export const LOGO_SRC = '/logos/analytics-avenue-mark.png';
export const LOGO_NAME = 'Analytics Avenue';

const SIZES = {
  sm: 'h-8',
  md: 'h-12',
  lg: 'h-14',
  xl: 'h-16',
  '2xl': 'h-24',
  '3xl': 'h-28',
  // Smaller on phones, where it shares the bar with buttons.
  nav: 'h-12 lg:h-14',
};

/**
 * Brand logo. `variant="full"` adds the tagline (footer, sign-in panel);
 * the default compact one suits 64px bars. The artwork is dark on a
 * transparent background, so on dark backgrounds (`tone="light"`) it sits on
 * a white tile. `compact` shows only the icon below md, for tight bars like
 * the course player's. `size` overrides the default height.
 */
export default function Logo({ to = '/', tone = 'dark', variant = 'compact', className = '', compact = false, size }) {
  const light = tone === 'light';
  const height = SIZES[size || (compact ? 'sm' : light ? 'md' : 'lg')];
  const src = variant === 'full' ? LOGO_FULL_SRC : LOGO_COMPACT_SRC;

  return (
    <Link
      to={to}
      aria-label={`${LOGO_NAME} — home`}
      className={`inline-flex shrink-0 items-center rounded-lg ${light ? `bg-white shadow-sm ${variant === 'full' ? 'px-4 py-3' : 'px-2.5 py-1'}` : ''} ${className}`}
    >
      {compact && <img src={LOGO_SRC} alt="" className={`${height} w-auto md:hidden`} />}
      <img src={src} alt="" className={`${height} w-auto max-w-none ${compact ? 'hidden md:block' : ''}`} />
    </Link>
  );
}
