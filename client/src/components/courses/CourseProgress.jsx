import ProgressBar from '../common/ProgressBar.jsx';

/** Course completion summary — percentage, bar and lesson count. */
export default function CourseProgress({ course, size = 'md', className = '' }) {
  const complete = course.progress >= 100;

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-ink-700">
          {complete ? 'Course complete' : 'Your progress'}
        </span>
        <span className="text-sm font-bold tabular-nums text-ink-900">{course.progress}%</span>
      </div>
      <ProgressBar
        value={course.progress}
        size={size}
        tone={complete ? 'success' : 'primary'}
        label={`${course.title} progress`}
      />
      <p className="mt-2 text-xs text-ink-500">
        {course.completedLessons} of {course.lessonCount} lessons completed
      </p>
    </div>
  );
}
