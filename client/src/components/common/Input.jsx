import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Labelled form field with optional leading icon, error text and a
 * password visibility toggle. Every input in the app goes through this.
 */
const Input = forwardRef(function Input(
  { label, type = 'text', icon: Icon, error, hint, className = '', id, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [revealed, setRevealed] = useState(false);

  const isPassword = type === 'password';
  const resolvedType = isPassword && revealed ? 'text' : type;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="field-label">
          {label}
        </label>
      )}

      <div className="relative">
        {Icon && (
          <Icon
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
          />
        )}
        <input
          ref={ref}
          id={inputId}
          type={resolvedType}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`field-input ${Icon ? 'pl-10' : ''} ${isPassword ? 'pr-11' : ''} ${
            error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''
          }`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            // Keep focus (and the caret) in the field while toggling.
            onMouseDown={(event) => event.preventDefault()}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            title={revealed ? 'Hide password' : 'Show password'}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-ink-400 transition hover:text-ink-700"
          >
            {/* The icon shows what a click will do, matching the label: an
                open eye ("Show password") while masked, a crossed-out eye
                ("Hide password") while visible. */}
            {revealed ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        )}
      </div>

      {error ? (
        <p id={`${inputId}-error`} className="field-error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-ink-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export default Input;
