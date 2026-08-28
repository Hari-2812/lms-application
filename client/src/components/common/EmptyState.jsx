/** Consistent "nothing here yet" panel with an optional call to action. */
export default function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={`card flex flex-col items-center px-6 py-14 text-center ${className}`}>
      {Icon && (
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary-50 text-primary-600">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
      )}
      <h3 className="mt-4 text-base font-semibold text-ink-900">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-600">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
