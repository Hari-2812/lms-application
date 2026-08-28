import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock, ListChecks } from 'lucide-react';
import { usePageMeta } from '../components/layout/DashboardLayout.jsx';
import Badge from '../components/common/Badge.jsx';
import Button from '../components/common/Button.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import ProgressBar from '../components/common/ProgressBar.jsx';
import Skeleton from '../components/common/Skeleton.jsx';
import StatsCard from '../components/dashboard/StatsCard.jsx';
import { ErrorState } from '../components/States.jsx';
import useLearningData from '../hooks/useLearningData.js';
import { courseStatus, formatWatchTime } from '../utils/course.js';

const STATUS_LABEL = {
  completed: { label: 'Completed', tone: 'success' },
  'in-progress': { label: 'In progress', tone: 'primary' },
  'not-started': { label: 'Not started', tone: 'neutral' },
};

export default function ProgressPage() {
  const {
    courses,
    status,
    error,
    lessonsFor,
    totalLessons,
    completedLessonCount,
    watchedSeconds,
    completedCourses,
  } = useLearningData();

  usePageMeta('Progress', 'Playback position is saved every few seconds while you watch.');

  if (status === 'error') return <ErrorState message={error} />;

  if (status === 'loading') {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-card" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-card" />
      </div>
    );
  }

  const overall = totalLessons ? Math.round((completedLessonCount / totalLessons) * 100) : 0;

  return (
    <div className="space-y-6">
      <section aria-label="Progress summary" className="grid gap-4 sm:grid-cols-3">
        <StatsCard
          icon={ListChecks}
          label="Lessons completed"
          value={`${completedLessonCount}/${totalLessons}`}
          tone="primary"
          progress={overall}
        />
        <StatsCard
          icon={Clock}
          label="Time watched"
          value={formatWatchTime(watchedSeconds)}
          tone="warning"
        />
        <StatsCard
          icon={CheckCircle2}
          label="Courses completed"
          value={`${completedCourses.length}/${courses.length}`}
          tone="success"
        />
      </section>

      {courses.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No progress to show yet"
          description="Once you start a lesson your progress will appear here."
          action={<Button to="/courses">Browse courses</Button>}
        />
      ) : (
        <section className="card overflow-hidden">
          <div className="border-b border-ink-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-ink-900">Progress by course</h2>
          </div>

          <ul className="divide-y divide-ink-100">
            {courses.map((course) => {
              const meta = STATUS_LABEL[courseStatus(course)];
              const lessons = lessonsFor(course._id);
              const nextLesson = lessons.find((l) => !l.progress?.completed);

              return (
                <li key={course._id} className="flex flex-wrap items-center gap-4 p-5 sm:flex-nowrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/my-courses/${course._id}`}
                        className="truncate text-sm font-semibold text-ink-900 hover:text-primary-700"
                      >
                        {course.title}
                      </Link>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </div>

                    <p className="mb-2 mt-1 truncate text-xs text-ink-500">
                      {course.completedLessons} of {course.lessonCount} lessons
                      {nextLesson ? ` · Up next: ${nextLesson.title}` : ''}
                    </p>

                    <ProgressBar
                      value={course.progress}
                      tone={course.progress >= 100 ? 'success' : 'primary'}
                      label={`${course.title} progress`}
                    />
                  </div>

                  <span className="w-12 shrink-0 text-right text-sm font-bold tabular-nums text-ink-900">
                    {course.progress}%
                  </span>

                  <Link
                    to={
                      nextLesson
                        ? `/learn/${course._id}/${nextLesson._id}`
                        : `/my-courses/${course._id}`
                    }
                    aria-label={`Open ${course.title}`}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ink-200 text-ink-600 transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
                  >
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
