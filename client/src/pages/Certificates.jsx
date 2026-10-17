import { useCallback, useEffect, useRef, useState } from 'react';
import { Award, Download, Sparkles, Trash2, X } from 'lucide-react';
import {
  deleteCertificate,
  generateSampleCertificate,
  getCertificates,
  toErrorMessage,
} from '../api/client';
import { usePageMeta } from '../components/layout/DashboardLayout.jsx';
import Badge from '../components/common/Badge.jsx';
import Button from '../components/common/Button.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import Input from '../components/common/Input.jsx';
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
 * The sample generator below is the "see what you'll get" flow: fill in the
 * inputs, and the server issues a real (watermarked) certificate that lands
 * in this same list.
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
  const samples = certificates.filter((c) => c.kind === 'sample');
  const inProgress = courses.filter((c) => c.progress > 0 && c.progress < 100);

  const handleDelete = async (certificate) => {
    if (!window.confirm('Remove this sample certificate?')) return;
    try {
      await deleteCertificate(certificate.id);
      setCertificates((prev) => prev.filter((c) => c.id !== certificate.id));
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

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
        {/* An earned certificate carries the learner's current profile name;
            a sample keeps whatever name was typed into the sample form. */}
        <CertificateFace
          certificate={certificate.kind === 'course' ? { ...certificate, holderName: student?.name } : certificate}
        />
      </div>

      <div
        className="flex flex-wrap items-center justify-between gap-3 p-5"
        data-print-hide="true"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink-900">{certificate.courseTitle}</p>
          <p className="mt-0.5 font-mono text-[11px] text-ink-500">{certificate.serial}</p>
        </div>

        <div className="flex items-center gap-2">
          {certificate.kind === 'sample' && (
            <button
              type="button"
              onClick={() => handleDelete(certificate)}
              aria-label={`Remove the sample certificate for ${certificate.courseTitle}`}
              className="rounded-lg p-2 text-ink-400 transition hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
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
            description="Finish every lesson in a course and your certificate is generated automatically, ready to download. You can also generate a sample below to see what one looks like."
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

      {/* --- Sample generator ------------------------------------------ */}
      <SampleGenerator
        defaultName={student?.name || ''}
        courses={courses}
        onGenerated={(certificate) => setCertificates((prev) => [certificate, ...prev])}
      />

      {/* --- Samples --------------------------------------------------- */}
      {samples.length > 0 && (
        <section>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-ink-900">Sample certificates</h2>
            <Badge tone="neutral">Not an award</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-500">
            Generated from the form above. Watermarked, and not verifiable as a real completion.
          </p>
          <div className="mt-4 grid gap-5 lg:grid-cols-2">{samples.map(renderCertificate)}</div>
        </section>
      )}
    </div>
  );
}

/**
 * The free sample flow. Takes the inputs a certificate needs and asks the
 * server to generate one, so the student sees the real artwork with their own
 * details on it rather than a mock-up.
 */
function SampleGenerator({ defaultName, courses, onGenerated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ recipientName: defaultName, courseTitle: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState(null);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const certificate = await generateSampleCertificate({
        recipientName: form.recipientName,
        courseTitle: form.courseTitle,
      });

      setGenerated(certificate);
      // A signed-in student gets the sample saved, so it belongs in the list
      // above too; `preview: true` means it was not persisted.
      if (!certificate.preview) onGenerated?.(certificate);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setGenerated(null);
    setForm({ recipientName: defaultName, courseTitle: '' });
  };

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-900">
            <Sparkles className="h-4 w-4 text-primary-600" aria-hidden="true" />
            Generate a sample certificate
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-500">
            Free, and no course completion needed. Fill in the details and the certificate is
            generated for you — the same artwork as a real one, watermarked as a sample.
          </p>
        </div>

        {!open && (
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Try it
          </Button>
        )}
      </div>

      {open && (
        <>
          {generated ? (
            <div className="mt-6">
              <div className="overflow-hidden rounded-xl border border-ink-100">
                <CertificateFace certificate={generated} />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <Button size="sm" variant="secondary" onClick={reset}>
                  Generate another
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setOpen(false);
                    reset();
                  }}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  Close
                </Button>
                {generated.preview ? (
                  <p className="text-xs text-ink-500">
                    Sign in to keep a generated certificate in this section.
                  </p>
                ) : (
                  <p className="text-xs text-ink-500">
                    Saved to your Sample certificates below, ready to download.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">
                  {error}
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Name on the certificate"
                  required
                  maxLength={80}
                  value={form.recipientName}
                  onChange={set('recipientName')}
                  placeholder="e.g. Priya Raman"
                />

                <div>
                  <label className="field-label" htmlFor="sample-course-title">
                    Course title
                  </label>
                  <input
                    id="sample-course-title"
                    className="field-input"
                    required
                    maxLength={120}
                    list="sample-course-options"
                    value={form.courseTitle}
                    onChange={set('courseTitle')}
                    placeholder="e.g. Data Analytics Foundations"
                  />
                  {/* Suggests the student's own courses while still allowing
                      any title to be typed in. */}
                  <datalist id="sample-course-options">
                    {courses.map((course) => (
                      <option key={course._id} value={course.title} />
                    ))}
                  </datalist>
                </div>

              </div>
              <p className="text-xs text-ink-500">The month and year are filled in from the day you download it.</p>

              <div className="flex flex-wrap items-center gap-2.5">
                <Button type="submit" loading={submitting} disabled={submitting}>
                  {submitting ? (
                    <>Generating…</>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                      Generate certificate
                    </>
                  )}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}
