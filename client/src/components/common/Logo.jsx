import { Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';

/** Brand mark. `tone="light"` is for dark backgrounds (footer, CTA band). */
export default function Logo({ to = '/', tone = 'dark', className = '' }) {
  const light = tone === 'light';

  return (
    <Link
      to={to}
      className={`inline-flex min-w-0 items-center gap-2.5 rounded-lg ${className}`}
      aria-label="AnalyticsAvenue EduTech — home"
    >
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
          light ? 'bg-white text-primary-700' : 'bg-primary-600 text-white'
        }`}
      >
        <GraduationCap className="h-5 w-5" aria-hidden="true" />
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
