/** Small status / category label. Tones map to the semantic colour roles. */
const tones = {
  neutral: 'bg-ink-100 text-ink-700',
  primary: 'bg-primary-50 text-primary-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  error: 'bg-red-50 text-red-700',
  outline: 'border border-ink-200 bg-white text-ink-600',
  overlay: 'bg-ink-900/60 text-white backdrop-blur-sm',
};

export default function Badge({ tone = 'neutral', icon: Icon, className = '', children }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold
                  leading-none tracking-wide ${tones[tone] ?? tones.neutral} ${className}`}
    >
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {children}
    </span>
  );
}
