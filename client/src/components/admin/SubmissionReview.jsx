import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, ExternalLink, Send } from 'lucide-react';
import { getAllSubmissions, reviewSubmission, toErrorMessage } from '../../api/client';
import Button from '../common/Button.jsx';
import { AdminTabs, EmptyRow, LoadingRow, Panel, Pill, formatDate, useFlash } from './ui.jsx';

/**
 * The review queue for learner task submissions.
 *
 * Each row carries the Drive link, the learner's description, and a place to
 * set an outcome with feedback and a score. Accepting or sending back
 * notifies the learner with the feedback and score.
 */

const STATUS_META = {
  submitted: { label: 'New', tone: 'blue' },
  under_review: { label: 'Under review', tone: 'blue' },
  accepted: { label: 'Accepted', tone: 'green' },
  needs_revision: { label: 'Needs revision', tone: 'amber' },
};

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'submitted', label: 'New' },
  { value: 'under_review', label: 'Reviewing' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'needs_revision', label: 'Needs revision' },
];

export default function SubmissionReview({ refreshKey = 0 }) {
  const flash = useFlash();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('submitted');
  // Per-row drafts, so typing in one row never touches another.
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);

  const showError = flash.error;
  useEffect(() => {
    setLoading(true);
    getAllSubmissions(filter ? { status: filter } : undefined)
      .then(setSubmissions)
      .catch((err) => showError(toErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [filter, refreshKey, showError]);

  const draftOf = (s) => drafts[s.id] || {};
  const setDraft = (s, patch) => setDrafts((prev) => ({ ...prev, [s.id]: { ...prev[s.id], ...patch } }));

  const handleReview = async (submission, status) => {
    const draft = draftOf(submission);
    const scoreText = draft.score ?? (submission.score ?? '');
    setSavingId(submission.id);

    try {
      const updated = await reviewSubmission(submission.id, {
        status,
        feedback: draft.feedback ?? submission.feedback ?? '',
        score: scoreText === '' ? null : Number(scoreText),
      });

      // A filtered view should drop a row that no longer matches it.
      setSubmissions((prev) =>
        filter && updated.status !== filter
          ? prev.filter((s) => s.id !== submission.id)
          : prev.map((s) => (s.id === submission.id ? { ...s, ...updated, studentId: s.studentId, courseId: s.courseId, assignmentId: s.assignmentId } : s))
      );
      setDrafts((prev) => ({ ...prev, [submission.id]: undefined }));
      flash.success(
        status === 'under_review'
          ? 'Marked as under review.'
          : `Review saved — ${submission.studentId?.name || 'the learner'} has been notified.`
      );
    } catch (err) {
      flash.error(toErrorMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Panel
      id="submissions"
      icon={ClipboardCheck}
      title="Review queue"
      description="Learner work submitted as Drive links. Your feedback and score are sent to the learner."
      bodyClassName=""
    >
      <div className="border-b border-ink-100 px-5 py-3 sm:px-6">
        <AdminTabs tabs={FILTERS} value={filter} onChange={setFilter} />
      </div>

      {flash.node && <div className="px-5 pt-4 sm:px-6">{flash.node}</div>}

      {loading ? (
        <LoadingRow label="Loading submissions…" />
      ) : submissions.length === 0 ? (
        <EmptyRow icon={ClipboardCheck} title={filter ? 'Nothing in this state' : 'No submissions yet'} />
      ) : (
        <div className="divide-y divide-ink-100">
          {submissions.map((submission) => {
            const meta = STATUS_META[submission.status] || STATUS_META.submitted;
            const draft = draftOf(submission);
            const maxScore = submission.assignmentId?.maxScore || 100;
            const late =
              submission.assignmentId?.dueDate && new Date(submission.createdAt) > new Date(submission.assignmentId.dueDate);
            const busy = savingId === submission.id;

            return (
              <article key={submission.id} className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={meta.tone}>{meta.label}</Pill>
                      <Pill tone="gray">{submission.category}</Pill>
                      {submission.courseId?.title && <Pill tone="blue">{submission.courseId.title}</Pill>}
                      {late && <Pill tone="red">Submitted late</Pill>}
                    </div>

                    <p className="mt-3 text-sm font-semibold text-ink-900">
                      {submission.assignmentId?.title || submission.title || 'Untitled submission'}
                    </p>
                    {submission.assignmentId && submission.title && (
                      <p className="text-[13px] font-medium text-ink-700">{submission.title}</p>
                    )}
                    <p className="mt-1 text-[13px]">
                      {submission.studentId ? (
                        <Link to={`/admin/learners/${submission.studentId.id}`} className="font-medium text-primary-700 hover:text-primary-800">
                          {submission.studentId.name}
                        </Link>
                      ) : (
                        'Unknown learner'
                      )}
                      <span className="text-ink-500"> · {submission.studentId?.email}</span>
                    </p>
                    <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-ink-600">{submission.description}</p>
                    <p className="mt-2 text-[11px] text-ink-400">
                      Submitted {formatDate(submission.createdAt, true)}
                      {submission.assignmentId?.dueDate ? ` · due ${formatDate(submission.assignmentId.dueDate, true)}` : ''}
                    </p>
                  </div>

                  <Button href={submission.driveLink} target="_blank" rel="noopener noreferrer" size="sm" variant="secondary">
                    Open submission
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>

                <div className="mt-4 grid gap-3 rounded-lg border border-ink-100 bg-ink-50/50 p-4 md:grid-cols-[1fr_9rem]">
                  <div>
                    <label className="field-label" htmlFor={`feedback-${submission.id}`}>Feedback to the learner</label>
                    <textarea
                      id={`feedback-${submission.id}`}
                      className="field-input min-h-[70px] resize-y bg-white"
                      value={draft.feedback ?? submission.feedback ?? ''}
                      onChange={(e) => setDraft(submission, { feedback: e.target.value })}
                      maxLength={2000}
                      placeholder="What was good, what to change…"
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor={`score-${submission.id}`}>Score / {maxScore}</label>
                    <input
                      id={`score-${submission.id}`}
                      type="number"
                      min={0}
                      max={maxScore}
                      className="field-input bg-white"
                      value={draft.score ?? (submission.score ?? '')}
                      onChange={(e) => setDraft(submission, { score: e.target.value })}
                      placeholder="—"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 md:col-span-2">
                    <Button size="sm" loading={busy} disabled={busy} onClick={() => handleReview(submission, 'accepted')}>
                      <Send className="h-3.5 w-3.5" aria-hidden="true" />
                      Accept &amp; send
                    </Button>
                    <Button size="sm" variant="secondary" loading={busy} disabled={busy} onClick={() => handleReview(submission, 'needs_revision')}>
                      Needs revision
                    </Button>
                    {submission.status === 'submitted' && (
                      <Button size="sm" variant="ghost" loading={busy} disabled={busy} onClick={() => handleReview(submission, 'under_review')}>
                        Mark reviewing
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
