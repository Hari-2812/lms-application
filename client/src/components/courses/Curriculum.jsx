import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Lock, PlayCircle } from 'lucide-react';
import { formatDuration } from '../../utils/format.js';

/**
 * Course contents list, shared by the course details page and the learning
 * sidebar.
 *
 * States: ✓ completed · ▶ playing now · ○ available · 🔒 locked
 * A lesson is only ever locked when `isLocked` says so — by default students
 * can jump anywhere, which is how the existing app behaves.
 *
 * `theme="dark"` is used by the video-learning panel, which sits on the dark
 * shell rather than on a white card.
 */
const THEMES = {
  light: {
    divide: 'divide-ink-100',
    row: 'hover:bg-ink-50',
    active: 'bg-primary-50/70',
    title: 'text-ink-800',
    activeTitle: 'text-primary-700',
    order: 'text-ink-400',
    meta: 'text-ink-500',
    duration: 'text-ink-400',
    idle: 'text-ink-300',
  },
  dark: {
    divide: 'divide-ink-800',
    row: 'hover:bg-ink-800/70',
    active: 'bg-primary-600/15',
    title: 'text-ink-200',
    activeTitle: 'text-primary-300',
    order: 'text-ink-500',
    meta: 'text-ink-500',
    duration: 'text-ink-500',
    idle: 'text-ink-600',
  },
};

export default function Curriculum({
  lessons = [],
  courseId,
  activeLessonId,
  linkTo = (cid, lid) => `/learn/${cid}/${lid}`,
  isLocked,
  theme = 'light',
  className = '',
}) {
  const t = THEMES[theme] ?? THEMES.light;

  return (
    <ol className={`divide-y ${t.divide} ${className}`}>
      {lessons.map((lesson, index) => {
        const isActive = lesson._id === activeLessonId;
        const isDone = Boolean(lesson.progress?.completed);
        const locked = isLocked ? isLocked(lesson, index) : false;
        const watched = lesson.progress?.percent || 0;

        const content = (
          <>
            <span className="shrink-0" aria-hidden="true">
              {isDone ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : locked ? (
                <Lock className={`h-5 w-5 ${t.idle}`} />
              ) : isActive ? (
                <PlayCircle className="h-5 w-5 text-primary-500" />
              ) : (
                <Circle className={`h-5 w-5 ${t.idle}`} />
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span
                className={`block truncate text-sm font-medium ${
                  isActive ? `font-semibold ${t.activeTitle}` : t.title
                }`}
              >
                <span className={`tabular-nums ${t.order}`}>
                  {String(lesson.order).padStart(2, '0')}
                </span>{' '}
                {lesson.title}
              </span>

              <span className={`mt-0.5 block text-[11px] ${t.meta}`}>
                {isDone
                  ? 'Completed'
                  : watched > 0
                    ? `${watched}% watched`
                    : locked
                      ? 'Locked'
                      : 'Not started'}
              </span>
            </span>

            <span className={`shrink-0 text-xs tabular-nums ${t.duration}`}>
              {formatDuration(lesson.duration)}
            </span>
          </>
        );

        const rowClass = `flex w-full items-center gap-3 px-4 py-3 text-left transition ${
          isActive ? t.active : t.row
        }`;

        return (
          <li key={lesson._id}>
            {locked ? (
              <div className={`${rowClass} cursor-not-allowed opacity-60`} aria-disabled="true">
                {content}
              </div>
            ) : (
              <Link
                to={linkTo(courseId, lesson._id)}
                aria-current={isActive ? 'true' : undefined}
                className={rowClass}
              >
                {content}
              </Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}
