import { useCallback, useEffect, useRef, useState } from 'react';
import { Award, Download } from 'lucide-react';
import { getCertificates, toErrorMessage } from '../api/client';
import { usePageMeta } from '../components/layout/DashboardLayout.jsx';
import Badge from '../components/common/Badge.jsx';
import Button from '../components/common/Button.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import ProgressBar from '../components/common/ProgressBar.jsx';
import Skeleton from '../components/common/Skeleton.jsx';
import CertificateFace from '../components/certificates/CertificateFace.jsx';
import { ErrorState } from '../components/States.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import useLearningData from '../hooks/useLearningData.js';
import usePrintCertificate from '../hooks/usePrintCertificate.js';

/**
 * The Certificate section.
 *
 * Earned certificates are generated server-side the moment a student
 * completes every lesson in a course — nothing here creates them, it only
 * lists what has been issued and prints it. GET /api/certificates also
 * catches up any course that was finished before certificates existed.
 *
 * Sample certificates are an admin-only template preview (Admin → Certificates)
 * and are never shown here.
 */
export default function Certificates() {
  const { student } = useAuth();
  const { courses, status: learningStatus, error: learningError } = useLearningData();
  const { print, printingId } = usePrintCertificate();

  const [certificates, setCertificates] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  // One ref per rendered certificate, so printing can target just that node.
  const faceRefs = useRef({});

  usePageMeta('Certificates', 'Generated automatically when you complete a course.');

  const load = useCallback(() => {
    getCertificates()
      .then((data) => {
        setCertificates(data);
        setStatus('ready');
      })
      .catch((err) => {
        setError(toErrorMessage(err));
        setStatus('error');
      });
  }, []);

  useEffect(load, [load]);

  const earned = certificates.filter((c) => c.kind === 'course');
  const inProgress = courses.filter((c) => c.progress > 0 && c.progress < 100);

  if (status === 'error') return <ErrorState message={error} />;

  if (status === 'loading') {
    return (
      <div className="grid gap-5 sm:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <Skeleton key={i} className="h-72 rounded-card" />
        ))}
      </div>
    );
  }

  /** One certificate card, with its own print target. */
  const renderCertificate = (certificate) => (
    <article key={certificate.id} className="card overflow-hidden">
      {/* This wrapper is the print target: usePrintCertificate tags it and
          the print stylesheet hides everything outside it. */}
      <div ref={(node) => { faceRefs.current[certificate.id] = node; }}>
        {/* An earned certificate carries the learner's current profile name. */}
        <CertificateFace certificate={{ ...certificate, holderName: student?.name }} />
      </div>

      <div
        className="flex flex-wrap items-center justify-between gap-3 p-5"
        data-print-hide="true"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink-900">{certificate.courseTitle}</p>
          <p className="mt-0.5 font-mono text-[11px] text-ink-500">{certificate.serial}</p>
        </div>

        <Button
          size="sm"
          variant="secondary"
          loading={printingId === certificate.id}
          onClick={() => print(certificate.id, faceRefs.current[certificate.id])}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Download
        </Button>
      </div>
    </article>
  );

  return (
    <div className="space-y-8">
      {/* --- Earned ---------------------------------------------------- */}
      <section>
        <h2 className="text-xl font-bold text-ink-900">Your certificates</h2>
        <p className="mt-1 text-sm text-ink-500">
          {earned.length
            ? `${earned.length} earned — generated automatically on completion.`
            : 'Complete every lesson in a course and your certificate appears here on its own.'}
        </p>

        {earned.length === 0 ? (
          <EmptyState
            className="mt-6"
            icon={Award}
            title="No certificates yet"
            description="Finish every lesson in a course and your certificate is generated automatically, ready to download."
            action={<Button to="/my-courses">Go to my courses</Button>}
          />
        ) : (
          <div className="mt-6 grid gap-5 lg:grid-cols-2">{earned.map(renderCertificate)}</div>
        )}
      </section>

      {/* --- Almost there ---------------------------------------------- */}
      {learningStatus === 'error' ? (
        <ErrorState message={learningError} />
      ) : (
        inProgress.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-ink-900">Almost there</h2>
            <p className="mt-1 text-sm text-ink-500">
              Finish these courses and their certificates generate automatically.
            </p>

            <ul className="card mt-4 divide-y divide-ink-100">
              {inProgress.map((course) => (
                <li key={course._id} className="flex flex-wrap items-center gap-4 p-5 sm:gap-5">
                  <div className="min-w-[12rem] flex-1">
                    <p className="truncate text-sm font-semibold text-ink-900">{course.title}</p>
                    <p className="mb-2 mt-0.5 text-xs text-ink-500">
                      {course.lessonCount - course.completedLessons} lessons remaining
                    </p>
                    <ProgressBar value={course.progress} label={`${course.title} progress`} />
                  </div>
                  <Badge tone="primary">{course.progress}%</Badge>
                  <Button to={`/my-courses/${course._id}`} size="sm" variant="soft">
                    Resume
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )
      )}
    </div>
  );
}
