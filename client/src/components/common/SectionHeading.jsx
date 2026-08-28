/** Consistent section header used across the landing page and dashboard. */
export default function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  action,
  className = '',
}) {
  const centered = align === 'center';

  return (
    <div
      className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${
        centered ? 'sm:flex-col sm:items-center' : ''
      } ${className}`}
    >
      <div className={`max-w-2xl ${centered ? 'text-center' : ''}`}>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className={`text-2xl sm:text-display-sm ${eyebrow ? 'mt-2.5' : ''}`}>{title}</h2>
        {description && (
          <p className="mt-3 text-[15px] leading-relaxed text-ink-600">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
