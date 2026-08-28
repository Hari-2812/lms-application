/**
 * Course / lesson progress indicator.
 * Exposes proper ARIA so screen readers announce the percentage.
 */
const sizes = { sm: 'h-1', md: 'h-1.5', lg: 'h-2' };

const tones = {
  primary: 'bg-primary-600',
  success: 'bg-emerald-500',
};

export default function ProgressBar({
  value = 0,
  size = 'md',
  tone = 'primary',
  label = 'Progress',
  className = '',
}) {
  const percent = Math.max(0, Math.min(100, Math.round(value || 0)));

  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={`w-full overflow-hidden rounded-full bg-ink-100 ${sizes[size] ?? sizes.md} ${className}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-700 ease-out ${
          tones[tone] ?? tones.primary
        }`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
