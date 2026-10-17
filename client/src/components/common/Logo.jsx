import { Link } from 'react-router-dom';
import { resolveMediaUrl } from '../../api/client';
import { useBranding } from '../../context/BrandingContext.jsx';

/**
 * Brand mark. `tone="light"` is for dark backgrounds (footer, CTA band,
 * the admin sidebar). Name, tagline and logo come from Settings → Branding.
 */
export default function Logo({ to = '/', tone = 'dark', className = '' }) {
  const { branding } = useBranding();
  const light = tone === 'light';
  const src = branding.logoUrl ? resolveMediaUrl(branding.logoUrl) : '/logos/logo-new.png';

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
        } ${branding.logoUrl && !light ? 'w-10' : ''}`}
      >
        <img
          src={src}
          alt=""
          className={`${light ? 'h-8' : 'h-10'} w-auto max-w-none object-contain`}
        />
      </span>
      <span className="min-w-0 leading-tight">
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
