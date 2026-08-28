import { AlertCircle, Loader2 } from 'lucide-react';

export function LoadingState({ label = 'Loading…' }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2.5 py-20 text-sm text-ink-500"
    >
      <Loader2 className="h-4 w-4 animate-spin text-primary-600" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorState({ message }) {
  return (
    <div role="alert" className="card flex items-start gap-3 p-5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-50 text-red-600">
        <AlertCircle className="h-4.5 w-4.5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink-900">Something went wrong</p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-600">{message}</p>
        <p className="mt-2 text-[13px] text-ink-500">
          Check that the API is running on{' '}
          <code className="rounded bg-ink-100 px-1 py-0.5 font-mono text-[12px]">
            http://localhost:5000
          </code>{' '}
          and that <code className="rounded bg-ink-100 px-1 py-0.5 font-mono text-[12px]">npm run seed</code>{' '}
          has been executed.
        </p>
      </div>
    </div>
  );
}
