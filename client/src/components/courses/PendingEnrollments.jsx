import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Hourglass } from 'lucide-react';
import { getMyEnrollments } from '../../api/client';
import Badge from '../common/Badge.jsx';

/**
 * Courses the student has checked out but whose payment an admin has not
 * confirmed yet.
 *
 * Without this, a paid enrolment vanishes between checkout and confirmation:
 * the course is not in My Courses (no access grant yet) and the receipt
 * screen is gone on the next navigation. Renders nothing when there is
 * nothing pending, so it costs an empty request and no layout.
 */
export default function PendingEnrollments() {
  const [pending, setPending] = useState([]);

  useEffect(() => {
    let cancelled = false;

    getMyEnrollments()
      .then((enrollments) => {
        if (cancelled) return;
        setPending(enrollments.filter((e) => e.status === 'pending'));
      })
      // A failure here just means the notice does not appear — My Courses
      // itself is unaffected, so there is nothing worth surfacing.
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  if (pending.length === 0) return null;

  return (
    <section
      aria-labelledby="pending-enrolments-heading"
      className="rounded-card border border-amber-200 bg-amber-50/60 p-5"
    >
      <div className="flex items-center gap-2">
        <Hourglass className="h-4 w-4 text-amber-600" aria-hidden="true" />
        <h3 id="pending-enrolments-heading" className="text-sm font-semibold text-ink-900">
          Awaiting payment confirmation
        </h3>
        <Badge tone="warning">{pending.length}</Badge>
      </div>

      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">
        These unlock as soon as we confirm the payment — you&apos;ll get a notification.
      </p>

      <ul className="mt-4 space-y-2">
        {pending.map((enrollment) => (
          <li
            key={enrollment.id || enrollment._id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-3.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink-900">
                {enrollment.courseId?.title || 'Course'}
              </p>
              <p className="mt-0.5 text-xs text-ink-500">
                {enrollment.amount > 0
                  ? `₹${Number(enrollment.amount).toLocaleString('en-IN')}`
                  : 'Free'}
                {enrollment.method ? ` · ${enrollment.method}` : ''}
              </p>
            </div>

            {enrollment.courseId?._id && (
              <Link
                to={`/courses/${enrollment.courseId._id}`}
                className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-primary-700 hover:text-primary-800"
              >
                View course
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
