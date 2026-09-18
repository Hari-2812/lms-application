import { Link } from 'react-router-dom';

/** Brand mark. `tone="light"` is for dark backgrounds (footer, CTA band). */
export default function Logo({ to = '/', tone = 'dark', className = '' }) {
  const light = tone === 'light';

  return (
    <Link
      to={to}
      className={`inline-flex min-w-0 items-center gap-2.5 rounded-lg ${className}`}
      aria-label="AnalyticsAvenue EduTech — home"
    >
      {/* The mark has dark outlines, so on dark backgrounds it sits on a white tile. */}
      <span
        className={`grid shrink-0 place-items-center overflow-hidden ${
          light ? 'h-10 w-10 rounded-lg bg-white' : 'h-10 w-7'
        }`}
      >
        <img
          src="/logos/logo-new.png"
          alt=""
          className={`${light ? 'h-8' : 'h-10'} w-auto max-w-none object-contain`}
        />
      </span>
      <span className="min-w-0 leading-tight">
        <span className={`block truncate text-sm font-bold ${light ? 'text-white' : 'text-ink-900'}`}>
          AnalyticsAvenue
        </span>
        <span className={`block text-[11px] ${light ? 'text-primary-200' : 'text-ink-500'}`}>
          EduTech
        </span>
      </span>
    </Link>
  );
}
