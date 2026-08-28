import { TrendingUp } from 'lucide-react';
import ProgressBar from '../common/ProgressBar.jsx';

const tones = {
  primary: 'bg-primary-50 text-primary-600',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  neutral: 'bg-ink-100 text-ink-600',
};

/** Single dashboard statistic: icon, large figure, label and optional trend. */
export default function StatsCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'primary',
  progress,
  trend,
}) {
  return (
    <article className="card p-5 transition duration-300 hover:border-ink-200 hover:shadow-card-hover">
      <div className="flex items-start justify-between gap-3">
        <span className={`grid h-11 w-11 place-items-center rounded-xl ${tones[tone] ?? tones.primary}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>

        {trend && (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
            <TrendingUp className="h-3 w-3" aria-hidden="true" />
            {trend}
          </span>
        )}
      </div>

      <p className="mt-4 text-2xl font-bold leading-none tracking-tight tabular-nums text-ink-900">
        {value}
      </p>
      <p className="mt-1.5 text-[13px] text-ink-500">{label}</p>

      {typeof progress === 'number' && (
        <ProgressBar value={progress} size="sm" className="mt-3.5" label={`${label} progress`} />
      )}
      {hint && <p className="mt-2 text-[11px] text-ink-500">{hint}</p>}
    </article>
  );
}
