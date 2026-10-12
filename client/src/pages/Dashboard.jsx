import { useMemo } from 'react';
import { Award, BookOpen, Clock, GraduationCap, Trophy } from 'lucide-react';
import { usePageMeta } from '../components/layout/DashboardLayout.jsx';
import StatsCard from '../components/dashboard/StatsCard.jsx';
import ContinueLearning from '../components/dashboard/ContinueLearning.jsx';
import RecentActivity from '../components/dashboard/RecentActivity.jsx';
import RecommendedCourses from '../components/dashboard/RecommendedCourses.jsx';
import LearningGoals from '../components/dashboard/LearningGoals.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import Button from '../components/common/Button.jsx';
import Skeleton from '../components/common/Skeleton.jsx';
import { ErrorState } from '../components/States.jsx';
import useLearningData from '../hooks/useLearningData.js';
import useWishlist from '../hooks/useWishlist.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatWatchTime, recommendFrom } from '../utils/course.js';

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-card" />
        ))}
      </div>
      <Skeleton className="h-56 rounded-card" />
      <Skeleton className="h-72 rounded-card" />
    </div>
  );
}

export default function Dashboard() {
  const { student } = useAuth();
  const { ids: wishlist, toggle: toggleWishlist } = useWishlist();

  const {
    courses,
    status,
    error,
    continueCourse,
    nextLesson,
    lessonsFor,
    totalLessons,
    completedLessonCount,
    lessonsRemaining,
    watchedSeconds,
    startedCourses,
    completedCourses,
    activity,
    completedThisWeek,
  } = useLearningData();

  const firstName = (student?.name || 'there').split(' ')[0];
  usePageMeta(undefined, `You have ${lessonsRemaining} lessons left across your courses.`);

  const recommended = useMemo(() => recommendFrom(courses, 3), [courses]);

  if (status === 'loading') return <DashboardSkeleton />;
  if (status === 'error') return <ErrorState message={error} />;

  /**
   * Every figure links to the page that holds its detail, so a student can
   * click straight from the number to the records behind it. The `?filter=`
   * values match the My Courses tabs — see pages/MyCourses.jsx.
   */
  const stats = [
    {
      icon: BookOpen,
      label: 'Courses enrolled',
      value: String(courses.length).padStart(2, '0'),
      hint: `${startedCourses.length} started`,
      tone: 'primary',
      to: '/my-courses',
    },
    {
      icon: GraduationCap,
      label: 'Courses completed',
      value: String(completedCourses.length).padStart(2, '0'),
      tone: 'success',
      progress: courses.length ? (completedCourses.length / courses.length) * 100 : 0,
      to: '/my-courses?filter=completed',
    },
    {
      icon: Clock,
      label: 'Time learned',
      value: formatWatchTime(watchedSeconds),
      hint: `${completedLessonCount} of ${totalLessons} lessons done`,
      tone: 'warning',
      to: '/progress',
    },
    {
      icon: Award,
      label: 'Certificates',
      value: String(completedCourses.length).padStart(2, '0'),
      hint: completedCourses.length ? 'Ready to download' : 'Finish a course to earn one',
      tone: 'neutral',
      to: '/certificates',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Greeting is duplicated here for small screens, where the sticky
          header collapses its subtitle. */}
      <div className="sm:hidden">
        <h2 className="text-xl font-bold text-ink-900">Hi {firstName} 👋</h2>
        <p className="mt-1 text-sm text-ink-500">Continue your learning journey.</p>
      </div>

      <section aria-label="Learning statistics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatsCard key={stat.label} {...stat} />
        ))}
      </section>

      {continueCourse ? (
        <ContinueLearning
          course={continueCourse}
          nextLesson={nextLesson}
          lessonCount={lessonsFor(continueCourse._id).length}
        />
      ) : (
        <EmptyState
          icon={Trophy}
          title="No courses yet"
          description="Browse the catalogue and enrol in your first course to get started."
          action={<Button to="/courses">Browse courses</Button>}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <RecentActivity items={activity} />
        <LearningGoals
          completedThisWeek={completedThisWeek}
          watchedSeconds={watchedSeconds}
          lessonsRemaining={lessonsRemaining}
        />
      </div>

      <RecommendedCourses
        courses={recommended}
        wishlist={wishlist}
        onToggleSave={toggleWishlist}
      />
    </div>
  );
}
