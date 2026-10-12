import { Link } from 'react-router-dom';
import { ChevronRight, Flame, ListChecks, Target, Timer } from 'lucide-react';
import ProgressBar from '../common/ProgressBar.jsx';
import { formatWatchTime } from '../../utils/course.js';

const WEEKLY_LESSON_GOAL = 5;

/**
 * Weekly goal panel.
 *
 * The goal itself is a fixed target; everything measured against it
 * (lessons completed this week, hours watched, lessons left) is derived from
 * real progress records.
 */
export default function LearningGoals({
  completedThisWeek = 0,
  watchedSeconds = 0,
  lessonsRemaining = 0,
  goal = WEEKLY_LESSON_GOAL,
}) {
  const percent = Math.min(100, Math.round((completedThisWeek / goal) * 100));

  // Each row links through to where that figure is broken down, so the
  // panel is a way into the detail rather than a read-only summary.
  const rows = [
    {
      icon: Timer,
      label: 'Time watched',
      value: formatWatchTime(watchedSeconds),
      tone: 'bg-primary-50 text-primary-600',
      to: '/progress',
    },
    {
      icon: ListChecks,
      label: 'Lessons remaining',
      value: lessonsRemaining,
      tone: 'bg-ink-100 text-ink-600',
      to: '/my-courses?filter=in-progress',
    },
    {
      icon: Flame,
      label: 'Completed this week',
      value: completedThisWeek,
      tone: 'bg-amber-50 text-amber-600',
      to: '/progress',
    },
  ];

  return (
    <section className="card p-5" aria-labelledby="learning-goals-heading">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-ink-400" aria-hidden="true" />
        <h2 id="learning-goals-heading" className="text-sm font-semibold text-ink-900">
          Weekly Goal
        </h2>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between">
          <p className="text-2xl font-bold tabular-nums text-ink-900">
            {completedThisWeek}
            <span className="text-base font-medium text-ink-400"> / {goal}</span>
          </p>
          <p className="text-sm font-semibold text-primary-700">{percent}%</p>
        </div>
        <p className="mt-1 text-[13px] text-ink-500">lessons completed this week</p>
        <ProgressBar
          value={percent}
          tone={percent >= 100 ? 'success' : 'primary'}
          className="mt-3"
          label="Weekly lesson goal"
        />
      </div>

      {/* Only dt/dd/div may appear inside a <dl>, so each row is a <div>
          with the link stretched across it rather than an <a> wrapper. */}
      <dl className="mt-6 space-y-1 border-t border-ink-100 pt-5">
        {rows.map(({ icon: Icon, label, value, tone, to }) => (
          <div
            key={label}
            className="group relative -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition
                       hover:bg-ink-50 focus-within:ring-2 focus-within:ring-primary-500/40"
          >
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tone}`}>
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <dt className="flex-1 text-[13px] text-ink-600 group-hover:text-ink-900">
              <Link
                to={to}
                aria-label={`${label}: ${value}. View details`}
                className="after:absolute after:inset-0 after:rounded-lg focus:outline-none"
              >
                {label}
              </Link>
            </dt>
            <dd className="text-sm font-semibold tabular-nums text-ink-900">{value}</dd>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-ink-300 transition group-hover:text-primary-600"
              aria-hidden="true"
            />
          </div>
        ))}
      </dl>
    </section>
  );
}
