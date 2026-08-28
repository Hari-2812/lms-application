import CourseCard from './CourseCard.jsx';
import { CourseCardSkeleton } from '../common/Skeleton.jsx';

/**
 * Responsive course grid: 1 column on mobile, 2 on tablet, 3 on desktop.
 * Cards are `h-full` so every row stays the same height.
 */
export default function CourseGrid({
  courses = [],
  variant = 'catalogue',
  loading = false,
  skeletonCount = 3,
  columns = 3,
  wishlist,
  onToggleSave,
  className = '',
}) {
  const columnClass =
    columns === 4
      ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
      : columns === 2
        ? 'sm:grid-cols-2'
        : 'sm:grid-cols-2 lg:grid-cols-3';

  return (
    <div className={`grid gap-5 sm:gap-6 ${columnClass} ${className}`}>
      {loading
        ? Array.from({ length: skeletonCount }, (_, i) => <CourseCardSkeleton key={i} />)
        : courses.map((course) => (
            <CourseCard
              key={course._id}
              course={course}
              variant={variant}
              saved={wishlist?.includes(course._id)}
              onToggleSave={onToggleSave}
            />
          ))}
    </div>
  );
}
