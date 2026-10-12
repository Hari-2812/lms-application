import { GraduationCap, ShieldCheck } from 'lucide-react';

/**
 * The certificate itself — the same markup on screen and on paper.
 *
 * Printing is driven from outside: usePrintCertificate tags the wrapper it
 * is given with `data-print-root`, and the `@media print` block in index.css
 * hides everything else on the page. So this component must not depend on
 * any surrounding layout, but it does not need to know it is being printed.
 */
export default function CertificateFace({ certificate, className = '' }) {
  const {
    recipientName,
    courseTitle,
    instructor,
    lessonCount,
    hours,
    serial,
    issuedAt,
    kind,
  } = certificate;

  const issued = issuedAt
    ? new Date(issuedAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  const isSample = kind === 'sample';

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br from-ink-900 via-ink-900 to-primary-900 p-6 sm:p-8 ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-10" aria-hidden="true" />

      {/* A sample must be impossible to mistake for an earned certificate. */}
      {isSample && (
        <span
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[24deg]
                     whitespace-nowrap text-[3.5rem] font-black tracking-widest text-white/[0.07] sm:text-[5rem]"
          aria-hidden="true"
        >
          SAMPLE
        </span>
      )}

      <div className="relative mx-auto max-w-2xl rounded-xl border border-white/15 px-6 py-8 text-center sm:px-10 sm:py-10">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white/10 text-amber-300">
          <GraduationCap className="h-6 w-6" aria-hidden="true" />
        </span>

        <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary-200">
          Certificate of Completion
        </p>

        <p className="mt-6 text-[11px] uppercase tracking-[0.14em] text-ink-400">
          This certifies that
        </p>
        <p className="mt-2 text-2xl font-bold text-white sm:text-[1.75rem]">{recipientName}</p>

        <p className="mt-5 text-[11px] uppercase tracking-[0.14em] text-ink-400">
          has successfully completed
        </p>
        <p className="mt-2 text-lg font-semibold text-white">{courseTitle}</p>

        {(lessonCount > 0 || hours > 0) && (
          <p className="mt-4 text-[11px] text-ink-400">
            {[
              lessonCount > 0 ? `${lessonCount} ${lessonCount === 1 ? 'lesson' : 'lessons'}` : null,
              hours > 0 ? `${hours}h of content` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}

        <div className="mt-8 flex flex-col items-center gap-4 border-t border-white/10 pt-6 sm:flex-row sm:justify-between sm:gap-6">
          <div className="text-center sm:text-left">
            <p className="text-[10px] uppercase tracking-[0.14em] text-ink-500">Issued on</p>
            <p className="mt-0.5 text-[13px] font-medium text-white">{issued}</p>
          </div>

          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.14em] text-ink-500">
              AnalyticsAvenue EduTech
            </p>
            {instructor && <p className="mt-0.5 text-[13px] font-medium text-white">{instructor}</p>}
          </div>

          <div className="text-center sm:text-right">
            <p className="text-[10px] uppercase tracking-[0.14em] text-ink-500">Certificate ID</p>
            <p className="mt-0.5 font-mono text-[12px] font-medium text-white">{serial}</p>
          </div>
        </div>

        {!isSample && (
          <p className="mt-5 inline-flex items-center gap-1.5 text-[10px] text-ink-500">
            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
            Verify this certificate with the ID above
          </p>
        )}
      </div>
    </div>
  );
}
