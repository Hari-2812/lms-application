import { accentOf, categoryIcon } from '../../utils/course.js';

/**
 * Course artwork.
 *
 * Uses course.thumbnail when the record has one. Otherwise it draws original
 * abstract artwork derived from the course's own accent and category — no
 * unrelated stock photography is pulled in.
 */
export default function CourseThumbnail({ course, className = '', rounded = '' }) {
  const accent = accentOf(course);
  const Icon = categoryIcon(course?.category || course?.title || '');

  if (course?.thumbnail) {
    return (
      <img
        src={course.thumbnail}
        alt={course.title}
        loading="lazy"
        decoding="async"
        className={`h-full w-full object-cover transition duration-500 ease-out group-hover:scale-105 ${rounded} ${className}`}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={`${course?.title || 'Course'} cover`}
      className={`relative h-full w-full overflow-hidden transition duration-500 ease-out group-hover:scale-105 ${rounded} ${className}`}
      style={{ backgroundImage: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
    >
      {/* Subtle geometry so the artwork reads as designed, not as a flat fill. */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.22]"
        viewBox="0 0 400 220"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <pattern id="cover-grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M28 0H0v28" fill="none" stroke="white" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="400" height="220" fill="url(#cover-grid)" />
        <circle cx="330" cy="26" r="88" fill="white" opacity="0.16" />
        <circle cx="52" cy="196" r="60" fill="white" opacity="0.12" />
      </svg>

      <span className="absolute inset-0 grid place-items-center">
        <Icon className="h-10 w-10 text-white/90" strokeWidth={1.5} aria-hidden="true" />
      </span>
    </div>
  );
}
