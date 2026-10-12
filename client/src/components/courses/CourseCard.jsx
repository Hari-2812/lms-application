import { Link } from 'react-router-dom';
import { BookOpen, CheckCircle2, Clock, Heart, Lock, PlayCircle, Users } from 'lucide-react';
import Badge from '../common/Badge.jsx';
import ProgressBar from '../common/ProgressBar.jsx';
import Rating from '../common/Rating.jsx';
import CourseThumbnail from './CourseThumbnail.jsx';
import { compactNumber, formatHours, formatPrice } from '../../utils/course.js';

/**
 * The one course card used by the catalogue, the landing page and the
 * dashboard.
 *
 * `variant`:
 *   catalogue — public browsing: price + rating, no progress
 *   enrolled  — inside the dashboard: progress bar + resume action
 */
export default function CourseCard({
  course,
  variant = 'catalogue',
  to,
  saved = false,
  onToggleSave,
}) {
  const isEnrolled = variant === 'enrolled';
  const isComplete = course.progress >= 100;
  const locked = course.hasAccess === false;
  const href = to || (isEnrolled ? `/my-courses/${course._id}` : `/courses/${course._id}`);

  const duration = formatHours(course.hours);
  const students = compactNumber(course.studentsCount);

  return (
    <article className="card-interactive group relative flex h-full min-w-0 flex-col overflow-hidden">
      <div className="relative aspect-[16/9] shrink-0 overflow-hidden bg-ink-100">
        <CourseThumbnail course={course} />

        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          {course.category ? (
            <Badge tone="overlay">{course.category}</Badge>
          ) : (
            <Badge tone="overlay">{course.level}</Badge>
          )}

          {onToggleSave && (
            <button
              type="button"
              onClick={() => onToggleSave(course._id)}
              aria-pressed={saved}
              aria-label={saved ? `Remove ${course.title} from wishlist` : `Save ${course.title} to wishlist`}
              className="relative z-10 grid h-8 w-8 place-items-center rounded-lg bg-white/90 text-ink-600
                         backdrop-blur transition hover:bg-white hover:text-red-600"
            >
              <Heart className={`h-4 w-4 ${saved ? 'fill-red-500 text-red-500' : ''}`} />
            </button>
          )}
        </div>

        {locked ? (
          <span className="absolute bottom-3 left-3">
            <Badge tone="overlay" icon={Lock}>
              Access restricted
            </Badge>
          </span>
        ) : (
          isComplete && (
            <span className="absolute bottom-3 left-3">
              <Badge tone="success" icon={CheckCircle2}>
                Completed
              </Badge>
            </span>
          )
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[15px] font-semibold leading-snug text-ink-900">
            <Link to={href} className="after:absolute after:inset-0 hover:text-primary-700">
              {course.title}
            </Link>
          </h3>
          {!isEnrolled && (
            <span className="shrink-0 text-right">
              <span className="block text-sm font-bold text-primary-700">
                {formatPrice(course.price)}
              </span>
              {course.originalPrice > course.price && (
                <span className="block text-[11px] text-ink-400 line-through">
                  {formatPrice(course.originalPrice)}
                </span>
              )}
            </span>
          )}
        </div>

        {/* The admin's short summary is written for exactly this slot; the
            longer description is the fallback for courses without one. */}
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-ink-600">
          {course.summary || course.description}
        </p>

        <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-500">
          {course.lessonCount ? (
            <span className="inline-flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              {course.lessonCount} {course.lessonCount === 1 ? 'lesson' : 'lessons'}
            </span>
          ) : null}
          {duration && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {duration}
            </span>
          )}
          {students && (
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {students}
            </span>
          )}
        </div>

        {/* Everything below is pinned to the bottom so cards line up. */}
        <div className="mt-auto pt-4">
          {isEnrolled ? (
            locked ? (
              /* Could be an admin revocation or a payment still being
                 confirmed — the course page knows which, so point there
                 rather than guessing at the reason here. */
              <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary-700">
                <Lock className="h-4 w-4" aria-hidden="true" />
                Locked — see details
              </p>
            ) : (
              <>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-medium text-ink-600">
                    {course.completedLessons ?? 0} of {course.lessonCount ?? 0} lessons
                  </span>
                  <span className="font-semibold tabular-nums text-ink-900">{course.progress}%</span>
                </div>
                <ProgressBar
                  value={course.progress}
                  tone={isComplete ? 'success' : 'primary'}
                  label={`${course.title} progress`}
                />
                <p className="mt-3.5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary-700">
                  <PlayCircle className="h-4 w-4" aria-hidden="true" />
                  {isComplete ? 'Review course' : course.progress > 0 ? 'Continue learning' : 'Start course'}
                </p>
              </>
            )
          ) : (
            <div className="flex items-center justify-between gap-3 border-t border-ink-100 pt-3.5">
              <span className="truncate text-xs text-ink-500">{course.instructor}</span>
              <Rating value={course.rating} />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
