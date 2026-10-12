import { useEffect, useState } from 'react';
import { AlertCircle, ClipboardList, ExternalLink, Loader2, Send } from 'lucide-react';
import { getAllSubmissions, reviewSubmission, toErrorMessage } from '../../api/client';
import Badge from '../common/Badge.jsx';
import Button from '../common/Button.jsx';
import Tabs from '../common/Tabs.jsx';

/**
 * The coordinator's review queue for student task submissions.
 *
 * Each row carries the Drive link, the student's description and a place to
 * set an outcome with feedback. Changing the status notifies the student.
 */

const STATUS_META = {
  submitted: { label: 'Submitted', tone: 'neutral' },
  under_review: { label: 'Under review', tone: 'primary' },
  accepted: { label: 'Accepted', tone: 'success' },
  needs_revision: { label: 'Needs revision', tone: 'warning' },
};

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'submitted', label: 'New' },
  { value: 'under_review', label: 'Reviewing' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'needs_revision', label: 'Needs revision' },
];

export default function SubmissionReview() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  // Per-row draft feedback, so typing in one row never touches another.
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);

  const load = (status) => {
    setLoading(true);
    getAllSubmissions(status ? { status } : undefined)
      .then(setSubmissions)
      .catch((err) => setError(toErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(filter);
  }, [filter]);

  const handleReview = async (submission, status) => {
    setSavingId(submission.id);
    setError('');

    try {
      const updated = await reviewSubmission(submission.id, {
        status,
        feedback: drafts[submission.id] ?? submission.feedback ?? '',
      });

      // A filtered view should drop a row that no longer matches it.
      setSubmissions((prev) =>
        filter && updated.status !== filter
          ? prev.filter((s) => s.id !== submission.id)
          : prev.map((s) => (s.id === submission.id ? { ...updated, studentId: s.studentId, courseId: s.courseId } : s))
      );
      setDrafts((prev) => ({ ...prev, [submission.id]: undefined }));
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  const pending = submissions.filter((s) => s.status === 'submitted').length;

  return (
    <section id="submissions" className="card scroll-mt-20 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 p-6">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
            <ClipboardList className="h-4 w-4 text-primary-600" aria-hidden="true" />
            Task submissions
          </h2>
          <p className="mt-1 text-[13px] text-ink-500">
            Student work submitted as Drive links. Changing the status notifies the student.
          </p>
        </div>
        {pending > 0 && <Badge tone="warning">{pending} awaiting review</Badge>}
      </div>

      <div className="border-b border-ink-100 px-6 py-3">
        <Tabs tabs={FILTERS} value={filter} onChange={setFilter} />
      </div>

      {error && (
        <div className="flex items-center gap-2 border-b border-red-100 bg-red-50 px-6 py-3 text-[13px] text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 p-6 text-sm text-ink-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading submissions...
        </div>
      ) : submissions.length === 0 ? (
        <p className="p-6 text-sm text-ink-500">
          {filter ? 'Nothing in this state.' : 'No submissions yet.'}
        </p>
      ) : (
        <div className="divide-y divide-ink-100">
          {submissions.map((submission) => {
            const meta = STATUS_META[submission.status] || STATUS_META.submitted;
            const draft = drafts[submission.id] ?? submission.feedback ?? '';

            return (
              <div key={submission.id} className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="primary">{submission.category}</Badge>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      {submission.courseId?.title && (
                        <Badge tone="neutral">{submission.courseId.title}</Badge>
                      )}
                    </div>

                    <p className="mt-2.5 text-sm font-semibold text-ink-900">
                      {submission.studentId?.name || 'Unknown student'}
                      <span className="font-normal text-ink-500">
                        {' '}
                        · {submission.studentId?.email}
                      </span>
                    </p>

                    {submission.title && (
                      <p className="mt-1.5 text-sm font-medium text-ink-800">{submission.title}</p>
                    )}
                    <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-ink-600">
                      {submission.description}
                    </p>
                    <p className="mt-2 text-[11px] text-ink-400">
                      {new Date(submission.createdAt).toLocaleString('en-GB', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>

                  <Button
                    href={submission.driveLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="sm"
                    variant="secondary"
                  >
                    Open submission
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>

                <div className="mt-4 rounded-lg bg-surface-muted p-4">
                  <label className="field-label" htmlFor={`feedback-${submission.id}`}>
                    Feedback to the student
                  </label>
                  <textarea
                    id={`feedback-${submission.id}`}
                    className="field-input min-h-[70px] resize-y bg-white"
                    value={draft}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [submission.id]: e.target.value }))
                    }
                    maxLength={2000}
                    placeholder="What was good, what to change…"
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={savingId === submission.id}
                      disabled={savingId === submission.id}
                      onClick={() => handleReview(submission, 'under_review')}
                    >
                      Mark reviewing
                    </Button>
                    <Button
                      size="sm"
                      loading={savingId === submission.id}
                      disabled={savingId === submission.id}
                      onClick={() => handleReview(submission, 'accepted')}
                    >
                      <Send className="h-3.5 w-3.5" aria-hidden="true" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={savingId === submission.id}
                      disabled={savingId === submission.id}
                      onClick={() => handleReview(submission, 'needs_revision')}
                    >
                      Needs revision
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
