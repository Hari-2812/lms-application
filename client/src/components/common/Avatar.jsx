/**
 * Initials avatar. Uses an image when one is supplied, otherwise derives
 * stable initials from the name — no external avatar service is contacted.
 */
const sizes = {
  xs: 'h-7 w-7 text-[10px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-xl',
};

export function initialsOf(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function Avatar({ name = '', src, size = 'md', className = '' }) {
  const dimension = sizes[size] ?? sizes.md;

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        loading="lazy"
        className={`${dimension} shrink-0 rounded-full object-cover ring-1 ring-ink-900/5 ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${dimension} grid shrink-0 place-items-center rounded-full bg-primary-600
                  font-semibold text-white ring-1 ring-ink-900/5 ${className}`}
    >
      {initialsOf(name) || '?'}
    </span>
  );
}
