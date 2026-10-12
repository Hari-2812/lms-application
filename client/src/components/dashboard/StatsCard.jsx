import { ArrowUpRight, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import ProgressBar from '../common/ProgressBar.jsx';

const tones = {
  primary: 'bg-primary-50 text-primary-600',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  neutral: 'bg-ink-100 text-ink-600',
};

/**
 * Single dashboard statistic: icon, large figure, label and optional trend.
 *
 * Pass `to` to make the whole card a link through to the page that holds the
 * detail behind the number — a metric the student can't click is a dead end,
 * and every figure on the dashboard has a section that explains it.
 */
export default function StatsCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'primary',
  progress,
  trend,
  to,
}) {
  const interactive = Boolean(to);

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className={`grid h-11 w-11 place-items-center rounded-xl ${tones[tone] ?? tones.primary}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>

        <div className="flex items-center gap-2">
          {trend && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
              <TrendingUp className="h-3 w-3" aria-hidden="true" />
              {trend}
            </span>
          )}
          {interactive && (
            <ArrowUpRight
              className="h-4 w-4 text-ink-300 transition group-hover:text-primary-600"
              aria-hidden="true"
            />
          )}
        </div>
      </div>

      <p className="mt-4 text-2xl font-bold leading-none tracking-tight tabular-nums text-ink-900">
        {value}
      </p>
      <p className="mt-1.5 text-[13px] text-ink-500">{label}</p>

      {typeof progress === 'number' && (
        <ProgressBar value={progress} size="sm" className="mt-3.5" label={`${label} progress`} />
      )}
      {hint && <p className="mt-2 text-[11px] text-ink-500">{hint}</p>}
    </>
  );

  if (interactive) {
    return (
      <Link
        to={to}
        // The label repeats inside the card, so the accessible name here
        // says where the link goes rather than just restating the number.
        aria-label={`${label}: ${value}. View details`}
        className="card group block p-5 text-left transition duration-300 hover:-translate-y-0.5 hover:border-primary-200
                   hover:shadow-card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
      >
        {body}
      </Link>
    );
  }

  return (
    <article className="card p-5 transition duration-300 hover:border-ink-200 hover:shadow-card-hover">
      {body}
    </article>
  );
}
