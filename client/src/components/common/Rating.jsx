import { Star } from 'lucide-react';

/**
 * Star rating. Renders nothing when the course has no rating yet, so the UI
 * never shows a made-up score.
 */
export default function Rating({ value = 0, count, size = 'sm', className = '' }) {
  if (!value) return null;

  const rounded = Math.round(value * 2) / 2;
  const starSize = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="flex items-center gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`${starSize} ${
              i <= rounded ? 'fill-amber-400 text-amber-400' : 'fill-ink-200 text-ink-200'
            }`}
          />
        ))}
      </span>
      <span className="text-xs font-semibold text-ink-800">{value.toFixed(1)}</span>
      {count ? <span className="text-xs text-ink-500">({count})</span> : null}
      <span className="sr-only">
        Rated {value} out of 5{count ? ` from ${count} reviews` : ''}
      </span>
    </span>
  );
}
