import { Link } from 'react-router-dom';
import { useBranding } from '../../context/BrandingContext.jsx';

/** The Analytics Avenue mark. Fixed: it is not editable from the admin panel. */
export const LOGO_SRC = '/logos/logo-new.png';

/**
 * Brand mark. `tone="light"` is for dark backgrounds (footer, CTA band,
 * the admin sidebar). The image is always the Analytics Avenue logo; the
 * name and tagline beside it come from Settings → Branding.
 * `compact` drops the name on small screens (tight bars like the player's).
 */
export default function Logo({ to = '/', tone = 'dark', className = '', compact = false }) {
  const { branding } = useBranding();
  const light = tone === 'light';

  return (
    <Link
      to={to}
      className={`inline-flex min-w-0 items-center gap-2.5 rounded-lg ${className}`}
      aria-label={`${branding.platformName} ${branding.tagline} — home`.trim()}
    >
      {/* The mark has dark outlines, so on dark backgrounds it sits on a white tile. */}
      <span
        className={`grid shrink-0 place-items-center overflow-hidden ${
          light ? 'h-10 w-10 rounded-lg bg-white' : 'h-10 w-7'
        }`}
      >
        <img
          src={LOGO_SRC}
          alt=""
          className={`${light ? 'h-8' : 'h-10'} w-auto max-w-none object-contain`}
        />
      </span>
      <span className={`min-w-0 leading-tight ${compact ? 'hidden md:block' : ''}`}>
        <span className={`block truncate text-sm font-bold ${light ? 'text-white' : 'text-ink-900'}`}>
          {branding.platformName}
        </span>
        {branding.tagline && (
          <span className={`block text-[11px] ${light ? 'text-primary-200' : 'text-ink-500'}`}>
            {branding.tagline}
          </span>
        )}
      </span>
    </Link>
  );
}
