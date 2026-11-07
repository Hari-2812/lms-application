import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { API_ORIGIN } from '../api/client';

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

/**
 * Failure panel used by every data-loading page.
 *
 * The hint under the message is chosen from the error itself rather than
 * being fixed. It used to always say "run npm run seed", which is advice
 * that wipes the catalogue — never the right answer to a page that failed
 * to load, and actively destructive on a populated database.
 */
export function ErrorState({ message }) {
  const displayMessage = typeof message === 'string' ? message : 'The API could not be reached.';

  const isExpiredSession = /invalid or expired token|not authenticated|no token provided/i.test(
    displayMessage
  );
  const isForbidden = /admin access required|access/i.test(displayMessage);

  // Where this build actually sends API calls: VITE_API_URL, or this site's
  // own /api (which the dev server proxies to the local API).
  const apiTarget = API_ORIGIN || `${window.location.origin}/api`;
  // axios says "Network Error" when no response could be read at all — the
  // API is down, or (on another domain) it does not accept this site (CORS).
  const isNetworkError = /network error/i.test(displayMessage);

  return (
    <div role="alert" className="card flex items-start gap-3 p-5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-50 text-red-600">
        <AlertCircle className="h-4.5 w-4.5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink-900">
          {isExpiredSession ? 'Your session has expired' : 'Something went wrong'}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-600">
          {isExpiredSession
            ? 'You have been signed out because your session is no longer valid.'
            : displayMessage}
        </p>

        {isExpiredSession ? (
          <Link
            to="/login"
            className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary-700 hover:text-primary-800"
          >
            Sign in again
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ) : isForbidden ? (
          <p className="mt-2 text-[13px] text-ink-500">
            Ask an administrator to grant you access to this course.
          </p>
        ) : (
          <p className="mt-2 text-[13px] text-ink-500">
            {isNetworkError ? 'No answer from the API at ' : 'Check that the API is running at '}
            <code className="break-all rounded bg-ink-100 px-1 py-0.5 font-mono text-[12px]">{apiTarget}</code>
            {isNetworkError && API_ORIGIN ? (
              <>
                . Check that it is running and that its CLIENT_URL allows{' '}
                <code className="break-all rounded bg-ink-100 px-1 py-0.5 font-mono text-[12px]">
                  {window.location.origin}
                </code>
                , then reload the page.
              </>
            ) : (
              ', then reload the page.'
            )}
          </p>
        )}
      </div>
    </div>
  );
}
