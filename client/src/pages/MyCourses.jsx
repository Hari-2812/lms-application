import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { usePageMeta } from '../components/layout/DashboardLayout.jsx';
import Button from '../components/common/Button.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import Tabs from '../components/common/Tabs.jsx';
import CourseGrid from '../components/courses/CourseGrid.jsx';
import PendingEnrollments from '../components/courses/PendingEnrollments.jsx';
import { ErrorState } from '../components/States.jsx';
import useCourses from '../hooks/useCourses.js';
import useWishlist from '../hooks/useWishlist.js';
import { courseStatus } from '../utils/course.js';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'not-started', label: 'Not Started' },
];

const FILTER_VALUES = new Set(FILTERS.map((f) => f.value));

export default function MyCourses() {
  const { courses: allCourses, status, error } = useCourses();
  const { ids: wishlist, toggle: toggleWishlist } = useWishlist();
  const [params, setParams] = useSearchParams();

  /**
   * The active tab lives in the URL, so the dashboard metrics can link
   * straight to a filtered view (`/my-courses?filter=completed`) and a
   * filtered list stays shareable and survives a back/forward step.
   */
  const requested = params.get('filter');
  const filter = FILTER_VALUES.has(requested) ? requested : 'all';

  const setFilter = (value) => {
    const next = new URLSearchParams(params);
    if (value && value !== 'all') next.set('filter', value);
    else next.delete('filter');
    setParams(next, { replace: true });
  };

  usePageMeta('My Courses', 'Everything you are enrolled in, in one place.');

  // Only courses the admin has actually granted — everything else lives in
  // the Browse Courses catalogue instead.
  const courses = useMemo(() => allCourses.filter((c) => c.hasAccess !== false), [allCourses]);

  const counts = useMemo(() => {
    const tally = { all: courses.length, 'in-progress': 0, completed: 0, 'not-started': 0 };
    for (const course of courses) tally[courseStatus(course)] += 1;
    return tally;
  }, [courses]);

  const visible = useMemo(
    () => (filter === 'all' ? courses : courses.filter((c) => courseStatus(c) === filter)),
    [courses, filter]
  );

  if (status === 'error') return <ErrorState message={error} />;

  const tabs = FILTERS.map((f) => ({ ...f, count: counts[f.value] }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink-900">My Courses</h2>
          <p className="mt-1 text-sm text-ink-500">
            {status === 'loading'
              ? 'Loading your courses…'
              : `${courses.length} ${courses.length === 1 ? 'course' : 'courses'} enrolled`}
          </p>
        </div>
        <Button to="/courses" variant="secondary" size="sm">
          Browse more courses
        </Button>
      </div>

      {/* Paid enrolments that have not been confirmed yet have no access
          grant, so they are absent from the list below — this is where the
          student sees them. */}
      <PendingEnrollments />

      <Tabs tabs={tabs} value={filter} onChange={setFilter} />

      {status !== 'loading' && visible.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={filter === 'all' ? 'No courses yet' : 'Nothing in this tab'}
          description={
            filter === 'all'
              ? 'Enrol in a course and it will show up here with your progress.'
              : 'Try another filter, or browse the catalogue for something new.'
          }
          action={<Button to="/courses">Browse courses</Button>}
        />
      ) : (
        <CourseGrid
          courses={visible}
          variant="enrolled"
          loading={status === 'loading'}
          skeletonCount={3}
          wishlist={wishlist}
          onToggleSave={toggleWishlist}
        />
      )}
    </div>
  );
}
