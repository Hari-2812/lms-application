import { forwardRef, useId } from 'react';

const Checkbox = forwardRef(function Checkbox({ label, error, className = '', id, ...props }, ref) {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <div className={className}>
      <div className="flex items-start gap-2.5">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-ink-300 text-primary-600
                     transition focus:ring-primary-500/40"
          {...props}
        />
        <label htmlFor={inputId} className="cursor-pointer text-sm leading-snug text-ink-700">
          {label}
        </label>
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
});

export default Checkbox;
