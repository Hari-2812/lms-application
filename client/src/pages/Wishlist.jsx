import { useMemo } from 'react';
import { Heart } from 'lucide-react';
import { usePageMeta } from '../components/layout/DashboardLayout.jsx';
import Button from '../components/common/Button.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import CourseGrid from '../components/courses/CourseGrid.jsx';
import { ErrorState } from '../components/States.jsx';
import useCourses from '../hooks/useCourses.js';
import useWishlist from '../hooks/useWishlist.js';

export default function Wishlist() {
  const { courses, status, error } = useCourses();
  const { ids, toggle } = useWishlist();

  usePageMeta('Wishlist', 'Courses you have saved for later.');

  const saved = useMemo(() => courses.filter((c) => ids.includes(c._id)), [courses, ids]);

  if (status === 'error') return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink-900">Wishlist</h2>
        <p className="mt-1 text-sm text-ink-500">
          {status === 'loading'
            ? 'Loading…'
            : `${saved.length} ${saved.length === 1 ? 'course' : 'courses'} saved`}
        </p>
      </div>

      {status !== 'loading' && saved.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Nothing saved yet"
          description="Tap the heart on any course to keep it here for later."
          action={<Button to="/courses">Browse courses</Button>}
        />
      ) : (
        <CourseGrid
          courses={saved}
          loading={status === 'loading'}
          skeletonCount={3}
          wishlist={ids}
          onToggleSave={toggle}
        />
      )}
    </div>
  );
}
