import { Award, Download, GraduationCap } from 'lucide-react';
import { usePageMeta } from '../components/layout/DashboardLayout.jsx';
import Badge from '../components/common/Badge.jsx';
import Button from '../components/common/Button.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import ProgressBar from '../components/common/ProgressBar.jsx';
import Skeleton from '../components/common/Skeleton.jsx';
import { ErrorState } from '../components/States.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import useLearningData from '../hooks/useLearningData.js';

/**
 * A certificate exists for every course the student has completed 100%.
 * Nothing is stored separately — completion is derived from the same progress
 * records the rest of the app uses.
 */
export default function Certificates() {
  const { student } = useAuth();
  const { courses, status, error, completedCourses } = useLearningData();

  usePageMeta('Certificates', 'Earned when you complete every lesson in a course.');

  if (status === 'error') return <ErrorState message={error} />;

  if (status === 'loading') {
    return (
      <div className="grid gap-5 sm:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <Skeleton key={i} className="h-64 rounded-card" />
        ))}
      </div>
    );
  }

  const inProgress = courses.filter((c) => c.progress > 0 && c.progress < 100);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-bold text-ink-900">Your certificates</h2>
        <p className="mt-1 text-sm text-ink-500">
          {completedCourses.length
            ? `${completedCourses.length} earned`
            : 'Complete a course to earn your first certificate.'}
        </p>

        {completedCourses.length === 0 ? (
          <EmptyState
            className="mt-6"
            icon={Award}
            title="No certificates yet"
            description="Finish every lesson in a course and your certificate will appear here, ready to download."
            action={<Button to="/my-courses">Go to my courses</Button>}
          />
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {completedCourses.map((course) => (
              <article key={course._id} className="card overflow-hidden">
                {/* Certificate face */}
                <div className="relative bg-gradient-to-br from-ink-900 via-ink-900 to-primary-900 p-6 text-center">
                  <div
                    className="pointer-events-none absolute inset-0 bg-grid opacity-10"
                    aria-hidden="true"
                  />
                  <div className="relative mx-auto max-w-xs rounded-xl border border-white/15 px-5 py-7">
                    <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-white/10 text-amber-300">
                      <GraduationCap className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-200">
                      Certificate of Completion
                    </p>
                    <p className="mt-3 text-base font-semibold text-white">{student?.name}</p>
                    <p className="mt-1 text-[11px] text-ink-400">has successfully completed</p>
                    <p className="mt-2 text-sm font-semibold text-white">{course.title}</p>
                    <p className="mt-4 text-[10px] text-ink-500">
                      AnalyticsAvenue EduTech · {course.lessonCount} lessons · {course.hours}h
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 p-5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-900">{course.title}</p>
                    <p className="mt-0.5 text-xs text-ink-500">{course.instructor}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    title="PDF export becomes available once the certificates API is added"
                    disabled
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Download
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {inProgress.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-ink-900">Almost there</h2>
          <p className="mt-1 text-sm text-ink-500">
            Finish these courses to unlock their certificates.
          </p>

          <ul className="card mt-4 divide-y divide-ink-100">
            {inProgress.map((course) => (
              <li key={course._id} className="flex items-center gap-5 p-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-900">{course.title}</p>
                  <p className="mb-2 mt-0.5 text-xs text-ink-500">
                    {course.lessonCount - course.completedLessons} lessons remaining
                  </p>
                  <ProgressBar value={course.progress} label={`${course.title} progress`} />
                </div>
                <Badge tone="primary">{course.progress}%</Badge>
                <Button to={`/my-courses/${course._id}`} size="sm" variant="soft">
                  Resume
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
