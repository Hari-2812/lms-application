import { ArrowRight } from 'lucide-react';
import Button from '../common/Button.jsx';
import CourseGrid from '../courses/CourseGrid.jsx';

/**
 * Courses the student has not started, ranked toward the categories they are
 * already learning (see recommendFrom in utils/course.js).
 */
export default function RecommendedCourses({ courses = [], wishlist, onToggleSave }) {
  if (courses.length === 0) return null;

  return (
    <section aria-labelledby="recommended-heading">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="recommended-heading" className="text-lg font-semibold text-ink-900">
            Recommended For You
          </h2>
          <p className="mt-1 text-[13px] text-ink-500">
            Based on the topics you are already learning.
          </p>
        </div>
        <Button to="/courses" variant="ghost" size="sm">
          Browse all
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <CourseGrid
        courses={courses}
        className="mt-5"
        wishlist={wishlist}
        onToggleSave={onToggleSave}
      />
    </section>
  );
}
