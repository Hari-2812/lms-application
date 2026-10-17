import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  ExternalLink,
  Info,
  Link2,
  RotateCcw,
  Send,
  Trash2,
} from 'lucide-react';
import {
  createSubmission,
  getAssignments,
  getMySubmissions,
  getSubmissionCategories,
  toErrorMessage,
  withdrawSubmission,
} from '../api/client';
import { usePageMeta } from '../components/layout/DashboardLayout.jsx';
import Badge from '../components/common/Badge.jsx';
import Button from '../components/common/Button.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import Input from '../components/common/Input.jsx';
import Skeleton from '../components/common/Skeleton.jsx';
import useCourses from '../hooks/useCourses.js';

/**
 * Task submission.
 *
 * Work is handed in as a Google Drive link rather than a file upload, so the
 * student keeps the original and nothing large is stored here. The link has
 * to be readable by the reviewer, which is why the sharing instruction is
 * stated on the form rather than buried in a help page — a locked link is
 * the most common reason a submission bounces back.
 */

const STATUS_META = {
  submitted: { label: 'Submitted', tone: 'neutral', icon: Clock },
  under_review: { label: 'Under review', tone: 'primary', icon: Clock },
  accepted: { label: 'Accepted', tone: 'success', icon: CheckCircle2 },
  needs_revision: { label: 'Needs revision', tone: 'warning', icon: RotateCcw },
};

const EMPTY = { category: '', title: '', description: '', driveLink: '', courseId: '', assignmentId: '' };

const formatDue = (value) =>
  new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function TaskSubmission() {
  const { courses } = useCourses();

  const [categories, setCategories] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');

  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  usePageMeta('Task Submission', 'Submit your work for review.');

  const load = () =>
    Promise.all([getSubmissionCategories(), getMySubmissions(), getAssignments().catch(() => [])])
      .then(([meta, mine, tasks]) => {
        setCategories(meta.categories || []);
        setSubmissions(mine);
        setAssignments(tasks);
        setStatus('ready');
      })
      .catch((err) => {
        setLoadError(toErrorMessage(err));
        setStatus('error');
      });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load only runs on mount
  }, []);

  const set = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const created = await createSubmission({
        category: form.category,
        title: form.title,
        description: form.description,
        driveLink: form.driveLink,
        courseId: form.courseId || undefined,
        assignmentId: form.assignmentId || undefined,
      });

      const task = assignments.find((a) => a.id === form.assignmentId);
      setSubmissions((prev) => [{ ...created, assignmentId: task || null }, ...prev]);
      if (task) {
        setAssignments((prev) =>
          prev.map((a) => (a.id === task.id ? { ...a, mySubmission: { status: 'submitted', score: null } } : a))
        );
      }
      setForm(EMPTY);
      setSuccess('Submitted. Your coordinator can now review it.');
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async (submission) => {
    if (!window.confirm('Withdraw this submission? You can submit it again afterwards.')) return;

    try {
      await withdrawSubmission(submission.id);
      setSubmissions((prev) => prev.filter((s) => s.id !== submission.id));
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  if (status === 'error') {
    return (
      <div role="alert" className="card p-5">
        <p className="text-sm font-semibold text-ink-900">Could not load submissions</p>
        <p className="mt-1 text-[13px] text-ink-600">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-ink-900">Task Submission</h2>
        <p className="mt-1 text-sm text-ink-500">
          Share your work as a Google Drive link and your coordinator will review it.
        </p>
      </div>

      {/* --- tasks set by the coordinator ------------------------------- */}
      {assignments.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-ink-900">
            <CalendarClock className="h-5 w-5 text-primary-600" aria-hidden="true" />
            Your tasks
          </h3>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {assignments.map((task) => {
              const overdue = task.dueDate && new Date(task.dueDate) < new Date();
              const mine = task.mySubmission;
              const meta = mine ? STATUS_META[mine.status] || STATUS_META.submitted : null;
              return (
                <li key={task.id} className="card flex flex-col p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    {task.courseId?.title && <Badge tone="primary">{task.courseId.title}</Badge>}
                    {task.dueDate && (
                      <Badge tone={overdue && !mine ? 'error' : 'neutral'} icon={Clock}>
                        {overdue ? 'Was due' : 'Due'} {formatDue(task.dueDate)}
                      </Badge>
                    )}
                    {meta && <Badge tone={meta.tone}>{meta.label}</Badge>}
                  </div>
                  <p className="mt-2.5 text-sm font-semibold text-ink-900">{task.title}</p>
                  {task.description && (
                    <p className="mt-1 line-clamp-3 whitespace-pre-line text-[13px] leading-relaxed text-ink-600">{task.description}</p>
                  )}
                  <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                    <span className="text-[12px] text-ink-500">
                      {mine && mine.score !== null && mine.score !== undefined ? `Score ${mine.score}/${task.maxScore}` : `Out of ${task.maxScore}`}
                    </span>
                    <Button
                      size="sm"
                      variant={mine ? 'secondary' : 'primary'}
                      onClick={() => {
                        setForm((prev) => ({ ...prev, assignmentId: task.id, courseId: task.courseId?._id || '', title: prev.title || task.title }));
                        document.getElementById('submission-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                    >
                      {mine ? 'Submit again' : 'Submit work'}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* --- the form ------------------------------------------------- */}
      <section id="submission-form" className="card scroll-mt-24 p-6">
        <h3 className="flex items-center gap-2 text-base font-semibold text-ink-900">
          <Send className="h-4 w-4 text-primary-600" aria-hidden="true" />
          Submit a task
        </h3>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
          {success && (
            <p className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[13px] text-emerald-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {success}
            </p>
          )}

          {assignments.length > 0 && (
            <div>
              <label className="field-label" htmlFor="submission-task">
                Task (optional)
              </label>
              <select
                id="submission-task"
                className="field-input"
                value={form.assignmentId}
                onChange={(event) => {
                  const task = assignments.find((a) => a.id === event.target.value);
                  setForm((prev) => ({ ...prev, assignmentId: event.target.value, courseId: task?.courseId?._id || prev.courseId }));
                }}
              >
                <option value="">Not for a specific task</option>
                {assignments.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                    {task.dueDate ? ` — due ${formatDue(task.dueDate)}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="submission-category">
                Category
              </label>
              <select
                id="submission-category"
                required
                className="field-input"
                value={form.category}
                onChange={set('category')}
              >
                <option value="" disabled>
                  Choose a category…
                </option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label" htmlFor="submission-course">
                Course (optional)
              </label>
              <select
                id="submission-course"
                className="field-input"
                value={form.courseId}
                onChange={set('courseId')}
                disabled={Boolean(assignments.find((a) => a.id === form.assignmentId)?.courseId)}
              >
                <option value="">Not course-specific</option>
                {courses
                  .filter((c) => c.hasAccess !== false)
                  .map((course) => (
                    <option key={course._id} value={course._id}>
                      {course.title}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <Input
            label="Title (optional)"
            value={form.title}
            onChange={set('title')}
            maxLength={160}
            placeholder="e.g. Week 3 — Sales dashboard"
          />

          <div>
            <label className="field-label" htmlFor="submission-description">
              Description
            </label>
            <textarea
              id="submission-description"
              required
              maxLength={2000}
              className="field-input min-h-[110px] resize-y"
              value={form.description}
              onChange={set('description')}
              placeholder="Briefly describe what you built, what it covers and anything the reviewer should know."
            />
            <p className="mt-1.5 text-xs text-ink-500">{form.description.length}/2000 characters.</p>
          </div>

          <Input
            label="Google Drive link"
            icon={Link2}
            required
            type="url"
            value={form.driveLink}
            onChange={set('driveLink')}
            placeholder="https://drive.google.com/file/d/…"
          />

          {/* The single most common reason a submission comes back. */}
          <div className="flex items-start gap-2.5 rounded-lg bg-primary-50/70 p-3.5 text-[13px] leading-relaxed text-ink-700">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
            <span>
              <strong className="font-semibold text-ink-900">Set sharing before you submit.</strong>{' '}
              In Drive: <em>Share → General access →</em>{' '}
              <strong className="font-semibold">Anyone with the link</strong> → role{' '}
              <strong className="font-semibold">Viewer</strong>. A restricted link cannot be opened
              by your reviewer and will be sent back.
            </span>
          </div>

          <Button type="submit" loading={submitting} disabled={submitting}>
            <Send className="h-4 w-4" aria-hidden="true" />
            Submit task
          </Button>
        </form>
      </section>

      {/* --- previous submissions -------------------------------------- */}
      <section>
        <h3 className="text-lg font-semibold text-ink-900">Your submissions</h3>
        <p className="mt-1 text-sm text-ink-500">
          {status === 'loading'
            ? 'Loading…'
            : `${submissions.length} ${submissions.length === 1 ? 'submission' : 'submissions'}`}
        </p>

        {status === 'loading' ? (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 2 }, (_, i) => (
              <Skeleton key={i} className="h-28 rounded-card" />
            ))}
          </div>
        ) : submissions.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon={ClipboardList}
            title="Nothing submitted yet"
            description="Use the form above to submit your first task. It will appear here with its review status."
          />
        ) : (
          <ul className="mt-4 space-y-3">
            {submissions.map((submission) => {
              const meta = STATUS_META[submission.status] || STATUS_META.submitted;
              const StatusIcon = meta.icon;

              return (
                <li key={submission.id} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="primary">{submission.category}</Badge>
                        <Badge tone={meta.tone} icon={StatusIcon}>
                          {meta.label}
                        </Badge>
                        {submission.courseId?.title && (
                          <Badge tone="neutral">{submission.courseId.title}</Badge>
                        )}
                      </div>

                      {(submission.assignmentId?.title || submission.title) && (
                        <p className="mt-2.5 text-sm font-semibold text-ink-900">
                          {submission.assignmentId?.title || submission.title}
                        </p>
                      )}
                      {submission.assignmentId?.title && submission.title && (
                        <p className="text-[13px] text-ink-700">{submission.title}</p>
                      )}
                      <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-ink-600">
                        {submission.description}
                      </p>

                      <p className="mt-2 text-[11px] text-ink-400">
                        Submitted{' '}
                        {new Date(submission.createdAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        href={submission.driveLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="sm"
                        variant="secondary"
                      >
                        Open link
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                      {submission.status === 'submitted' && (
                        <button
                          type="button"
                          onClick={() => handleWithdraw(submission)}
                          aria-label="Withdraw this submission"
                          className="rounded-lg p-2 text-ink-400 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>

                  {(submission.feedback || (submission.score !== null && submission.score !== undefined)) && (
                    <div className="mt-4 rounded-lg bg-surface-muted p-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                          Reviewer feedback
                        </p>
                        {submission.score !== null && submission.score !== undefined && (
                          <Badge tone="primary">
                            Score {submission.score}/{submission.assignmentId?.maxScore || 100}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-ink-700">
                        {submission.feedback}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
