import { ArrowRight, BookOpen, Clock, PlayCircle } from 'lucide-react';
import Badge from '../common/Badge.jsx';
import Button from '../common/Button.jsx';
import ProgressBar from '../common/ProgressBar.jsx';
import CourseThumbnail from '../courses/CourseThumbnail.jsx';
import { formatHours } from '../../utils/course.js';

/**
 * The dashboard's primary section: the course the student was last working
 * through, with a single obvious action to resume it.
 *
 * `nextLesson` is the first lesson that is not yet complete — when it is
 * available the button deep-links straight into the player.
 */
export default function ContinueLearning({ course, nextLesson, lessonCount }) {
  if (!course) return null;

  const totalLessons = lessonCount ?? course.lessonCount ?? 0;
  const position = nextLesson ? nextLesson.order : (course.completedLessons ?? 0) + 1;
  const duration = formatHours(course.hours);

  const target = nextLesson
    ? `/learn/${course._id}/${nextLesson._id}`
    : `/my-courses/${course._id}`;

  return (
    <section aria-labelledby="continue-learning-heading">
      <h2 id="continue-learning-heading" className="text-lg font-semibold text-ink-900">
        Continue Learning
      </h2>

      <div className="card mt-4 overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
          <div className="group relative aspect-[16/9] w-full shrink-0 overflow-hidden rounded-xl bg-ink-100 sm:aspect-square sm:w-32 lg:w-40">
            <CourseThumbnail course={course} />
            <span className="absolute inset-0 grid place-items-center bg-ink-950/20">
              <PlayCircle className="h-9 w-9 text-white drop-shadow" aria-hidden="true" />
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {course.category && <Badge tone="primary">{course.category}</Badge>}
              <span className="text-xs text-ink-500">{course.instructor}</span>
            </div>

            <h3 className="mt-2 text-lg font-semibold leading-snug text-ink-900">{course.title}</h3>

            <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-600">
              {nextLesson ? (
                <span className="inline-flex items-center gap-1.5">
                  <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  Up next: {nextLesson.title}
                </span>
              ) : (
                <span>All lessons complete</span>
              )}
            </p>

            <div className="mt-4 max-w-md">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-3 text-ink-500">
                  <span className="inline-flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                    Lesson {Math.min(position, totalLessons)} of {totalLessons}
                  </span>
                  {duration && (
                    <span className="hidden items-center gap-1.5 sm:inline-flex">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      {duration}
                    </span>
                  )}
                </span>
                <span className="font-semibold tabular-nums text-ink-900">
                  {course.progress}% complete
                </span>
              </div>
              <ProgressBar value={course.progress} label={`${course.title} progress`} />
            </div>
          </div>

          <Button to={target} size="lg" className="w-full sm:w-auto">
            Continue Learning
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </section>
  );
}
