import { Award, BookOpen, Flame, GraduationCap, Lock, Medal, Rocket, Timer } from 'lucide-react';
import { usePageMeta } from '../components/layout/DashboardLayout.jsx';
import ProgressBar from '../components/common/ProgressBar.jsx';
import Skeleton from '../components/common/Skeleton.jsx';
import { ErrorState } from '../components/States.jsx';
import useLearningData from '../hooks/useLearningData.js';

/**
 * Badges unlocked by real milestones.
 *
 * Each badge declares what it measures and its target; progress is computed
 * from the same API-derived figures the dashboard shows, so nothing here can
 * drift out of sync with the student's actual record.
 */
function buildBadges({ startedCourses, completedLessonCount, watchedSeconds, completedCourses, completedThisWeek }) {
  return [
    {
      id: 'first-steps',
      icon: Rocket,
      title: 'First Steps',
      description: 'Start your first course',
      current: startedCourses.length,
      target: 1,
      tone: 'bg-primary-50 text-primary-600',
    },
    {
      id: 'five-lessons',
      icon: BookOpen,
      title: 'Getting Going',
      description: 'Complete 5 lessons',
      current: completedLessonCount,
      target: 5,
      tone: 'bg-primary-50 text-primary-600',
    },
    {
      id: 'consistent',
      icon: Flame,
      title: 'Consistent',
      description: 'Complete 5 lessons in one week',
      current: completedThisWeek,
      target: 5,
      tone: 'bg-amber-50 text-amber-600',
    },
    {
      id: 'ten-hours',
      icon: Timer,
      title: 'Ten Hours In',
      description: 'Watch 10 hours of lessons',
      current: Math.floor(watchedSeconds / 3600),
      target: 10,
      tone: 'bg-amber-50 text-amber-600',
    },
    {
      id: 'graduate',
      icon: GraduationCap,
      title: 'Graduate',
      description: 'Complete your first course',
      current: completedCourses.length,
      target: 1,
      tone: 'bg-emerald-50 text-emerald-600',
    },
    {
      id: 'collector',
      icon: Award,
      title: 'Collector',
      description: 'Complete 3 courses',
      current: completedCourses.length,
      target: 3,
      tone: 'bg-emerald-50 text-emerald-600',
    },
  ];
}

export default function Achievements() {
  const data = useLearningData();
  const { status, error } = data;

  usePageMeta('Achievements', 'Milestones you have unlocked as you learn.');

  if (status === 'error') return <ErrorState message={error} />;

  if (status === 'loading') {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-40 rounded-card" />
        ))}
      </div>
    );
  }

  const badges = buildBadges(data);
  const unlocked = badges.filter((badge) => badge.current >= badge.target);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink-900">Achievements</h2>
          <p className="mt-1 text-sm text-ink-500">
            {unlocked.length} of {badges.length} unlocked
          </p>
        </div>
        <div className="w-full sm:max-w-xs">
          <ProgressBar
            value={(unlocked.length / badges.length) * 100}
            label="Achievements unlocked"
          />
        </div>
      </div>

      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {badges.map((badge) => {
          const isUnlocked = badge.current >= badge.target;
          const percent = Math.min(100, Math.round((badge.current / badge.target) * 100));
          const Icon = isUnlocked ? badge.icon : Lock;

          return (
            <li
              key={badge.id}
              className={`card p-5 transition ${isUnlocked ? '' : 'border-dashed bg-surface-muted'}`}
            >
              <div className="flex items-start gap-3.5">
                <span
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
                    isUnlocked ? badge.tone : 'bg-ink-100 text-ink-400'
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3
                      className={`truncate text-sm font-semibold ${
                        isUnlocked ? 'text-ink-900' : 'text-ink-600'
                      }`}
                    >
                      {badge.title}
                    </h3>
                    {isUnlocked && (
                      <Medal className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="Unlocked" />
                    )}
                  </div>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-ink-500">
                    {badge.description}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-[11px]">
                  <span className="text-ink-500">
                    {Math.min(badge.current, badge.target)} / {badge.target}
                  </span>
                  <span
                    className={`font-semibold ${isUnlocked ? 'text-emerald-700' : 'text-ink-600'}`}
                  >
                    {isUnlocked ? 'Unlocked' : `${percent}%`}
                  </span>
                </div>
                <ProgressBar
                  value={percent}
                  size="sm"
                  tone={isUnlocked ? 'success' : 'primary'}
                  label={badge.title}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
