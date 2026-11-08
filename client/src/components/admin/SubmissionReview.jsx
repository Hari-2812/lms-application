import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ClipboardCheck, ExternalLink, Filter, RotateCcw, Search, UserRound, X } from 'lucide-react';
import { getAdminAssignments, getAllSubmissions, getSubmissionCategories, reviewSubmission, toErrorMessage } from '../../api/client';
import Button from '../common/Button.jsx';
import { AdminTabs, EmptyRow, FilterBar, FilterField, LoadingRow, Panel, Pill, formatDate, useFlash } from './ui.jsx';

/**
 * The review queue for learner task submissions.
 *
 * Filter by learner (name / email search, or "only this learner" on a row),
 * course, task and category; the status tabs show how many submissions each
 * state holds under those filters. Each row carries the Drive link, the
 * learner's description, and a place to mark it Completed or send it back for
 * changes, with feedback and a score. Either outcome notifies the learner.
 */

const STATUS_META = {
  submitted: { label: 'New', tone: 'blue' },
  under_review: { label: 'Reviewing', tone: 'blue' },
  accepted: { label: 'Completed', tone: 'green' },
  needs_revision: { label: 'Needs changes', tone: 'amber' },
};

const STATUS_TABS = [
  { value: '', label: 'All', key: 'all' },
  { value: 'submitted', label: 'New' },
  { value: 'under_review', label: 'Reviewing' },
  { value: 'accepted', label: 'Completed' },
  { value: 'needs_revision', label: 'Needs changes' },
];

const NO_FILTERS = { courseId: '', assignmentId: '', category: '', student: null };

export default function SubmissionReview({ courses = [], refreshKey = 0, focus }) {
  const flash = useFlash();
  const [submissions, setSubmissions] = useState([]);
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('submitted');
  const [filters, setFilters] = useState(NO_FILTERS);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [categories, setCategories] = useState([]);
  // Per-row drafts, so typing in one row never touches another.
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);

  // Debounce the search box so each keystroke is not a request.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    getAdminAssignments().then(setAssignments).catch(() => {});
  }, [refreshKey]);

  useEffect(() => {
    getSubmissionCategories()
      .then((meta) => setCategories(meta.categories || []))
      .catch(() => {});
  }, []);

  // "View submissions" on a task in the list above jumps here, filtered to it.
  useEffect(() => {
    if (!focus) return;
    setFilters({ ...NO_FILTERS, courseId: focus.courseId || '', assignmentId: focus.assignmentId || '' });
    setStatus('');
    setQuery('');
    setSearch('');
    document.getElementById('submissions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focus]);

  const showError = flash.error;
  useEffect(() => {
    setLoading(true);
    const params = { summary: '1' };
    if (status) params.status = status;
    if (filters.courseId) params.courseId = filters.courseId;
    if (filters.assignmentId) params.assignmentId = filters.assignmentId;
    if (filters.category) params.category = filters.category;
    if (filters.student) params.studentId = filters.student.id;
    if (search) params.search = search;

    let stale = false;
    getAllSubmissions(params)
      .then((data) => {
        if (stale) return;
        setSubmissions(data.submissions || []);
        setCounts(data.counts || null);
      })
      .catch((err) => !stale && showError(toErrorMessage(err)))
      .finally(() => !stale && setLoading(false));
    return () => {
      stale = true;
    };
  }, [status, filters, search, refreshKey, showError]);

  // Task dropdown follows the course chosen: that course's tasks, plus tasks for everyone.
  const taskOptions = useMemo(() => {
    if (!filters.courseId || filters.courseId === 'none') return assignments;
    return assignments.filter((a) => !a.courseId || a.courseId._id === filters.courseId);
  }, [assignments, filters.courseId]);

  const setFilter = (key, value) =>
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      // A course change can strand the chosen task in another course.
      if (key === 'courseId' && prev.assignmentId && prev.assignmentId !== 'none') {
        const task = assignments.find((a) => a.id === prev.assignmentId);
        if (task?.courseId && task.courseId._id !== value) next.assignmentId = '';
      }
      return next;
    });

  const filtered = Boolean(filters.courseId || filters.assignmentId || filters.category || filters.student || search);
  const clearFilters = () => {
    setFilters(NO_FILTERS);
    setQuery('');
    setSearch('');
  };

  const draftOf = (s) => drafts[s.id] || {};
  const setDraft = (s, patch) => setDrafts((prev) => ({ ...prev, [s.id]: { ...prev[s.id], ...patch } }));

  const handleReview = async (submission, nextStatus) => {
    const draft = draftOf(submission);
    const scoreText = draft.score ?? (submission.score ?? '');
    const feedback = draft.feedback ?? submission.feedback ?? '';
    if (nextStatus === 'needs_revision' && !feedback.trim()) {
      flash.error('Add feedback so the learner knows what to change.');
      return;
    }
    setSavingId(submission.id);

    try {
      const updated = await reviewSubmission(submission.id, {
        status: nextStatus,
        feedback,
        score: scoreText === '' ? null : Number(scoreText),
      });

      // A filtered view should drop a row that no longer matches it.
      setSubmissions((prev) =>
        status && updated.status !== status
          ? prev.filter((s) => s.id !== submission.id)
          : prev.map((s) =>
              s.id === submission.id
                ? { ...s, ...updated, studentId: s.studentId, courseId: s.courseId, assignmentId: s.assignmentId }
                : s
            )
      );
      if (updated.status !== submission.status) {
        setCounts((prev) =>
          prev ? { ...prev, [submission.status]: Math.max(0, (prev[submission.status] || 0) - 1), [updated.status]: (prev[updated.status] || 0) + 1 } : prev
        );
      }
      setDrafts((prev) => ({ ...prev, [submission.id]: undefined }));
      flash.success(
        nextStatus === 'under_review'
          ? 'Marked as reviewing.'
          : `${nextStatus === 'accepted' ? 'Marked completed' : 'Sent back for changes'} — ${submission.studentId?.name || 'the learner'} has been notified.`
      );
    } catch (err) {
      flash.error(toErrorMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  const tabs = STATUS_TABS.map((t) => ({ ...t, count: counts ? counts[t.key || t.value] : undefined }));

  return (
    <Panel
      id="submissions"
      icon={ClipboardCheck}
      title="Review queue"
      description="Learner work submitted as Drive links. Mark it completed or ask for changes — your feedback and score are sent to the learner."
      bodyClassName=""
    >
      <FilterBar>
        <FilterField label="Find a student" className="lg:min-w-[14rem] lg:flex-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-400" aria-hidden="true" />
            <input
              type="search"
              className="admin-field w-full pl-9"
              placeholder="Name, email or submission title"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </FilterField>
        <FilterField label="Course" className="lg:w-52">
          <select className="admin-field" value={filters.courseId} onChange={(e) => setFilter('courseId', e.target.value)}>
            <option value="">All courses</option>
            {courses.map((c) => (
              <option key={c._id} value={c._id}>{c.title}</option>
            ))}
            <option value="none">Not course-specific</option>
          </select>
        </FilterField>
        <FilterField label="Task" className="lg:w-56">
          <select className="admin-field" value={filters.assignmentId} onChange={(e) => setFilter('assignmentId', e.target.value)}>
            <option value="">All tasks</option>
            {taskOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
                {!filters.courseId ? ` — ${a.courseId?.title || 'All learners'}` : ''}
              </option>
            ))}
            <option value="none">Not for a set task</option>
          </select>
        </FilterField>
        <FilterField label="Category" className="lg:w-44">
          <select className="admin-field" value={filters.category} onChange={(e) => setFilter('category', e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </FilterField>
        {filtered && (
          <Button size="sm" variant="ghost" onClick={clearFilters} className="lg:mb-0.5">
            <X className="h-4 w-4" aria-hidden="true" />
            Clear filters
          </Button>
        )}
      </FilterBar>

      <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 px-5 py-3 sm:px-6">
        <AdminTabs tabs={tabs} value={status} onChange={setStatus} />
        {filters.student && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 py-1 pl-3 pr-1 text-[12.5px] font-medium text-primary-800">
            <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
            {filters.student.name}
            <button
              type="button"
              onClick={() => setFilter('student', null)}
              aria-label={`Stop filtering by ${filters.student.name}`}
              className="rounded-full p-1 hover:bg-primary-100"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        )}
      </div>

      {flash.node && <div className="px-5 pt-4 sm:px-6">{flash.node}</div>}

      {loading && submissions.length === 0 ? (
        <LoadingRow label="Loading submissions…" />
      ) : submissions.length === 0 ? (
        <EmptyRow
          icon={ClipboardCheck}
          title={filtered || status ? 'Nothing matches these filters' : 'No submissions yet'}
          description={filtered ? 'Try clearing a filter or choosing another status.' : undefined}
        />
      ) : (
        <div className={`divide-y divide-ink-100 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {submissions.map((submission) => {
            const meta = STATUS_META[submission.status] || STATUS_META.submitted;
            const draft = draftOf(submission);
            const maxScore = submission.assignmentId?.maxScore || 100;
            const late =
              submission.assignmentId?.dueDate && new Date(submission.createdAt) > new Date(submission.assignmentId.dueDate);
            const busy = savingId === submission.id;
            const learner = submission.studentId;

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
                    <p className="mt-1 flex flex-wrap items-center gap-x-1 text-[13px]">
                      {learner ? (
                        <Link to={`/admin/learners/${learner.id}`} className="font-medium text-primary-700 hover:text-primary-800">
                          {learner.name}
                        </Link>
                      ) : (
                        'Unknown learner'
                      )}
                      {learner?.email && <span className="text-ink-500">· {learner.email}</span>}
                      {learner && filters.student?.id !== learner.id && (
                        <button
                          type="button"
                          onClick={() => setFilter('student', { id: learner.id, name: learner.name })}
                          className="ml-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-medium text-ink-500 transition hover:bg-primary-50 hover:text-primary-700"
                        >
                          <Filter className="h-3 w-3" aria-hidden="true" />
                          All by this student
                        </button>
                      )}
                    </p>
                    <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-ink-600">{submission.description}</p>
                    <p className="mt-2 text-[11px] text-ink-400">
                      Submitted {formatDate(submission.createdAt, true)}
                      {submission.assignmentId?.dueDate ? ` · due ${formatDate(submission.assignmentId.dueDate, true)}` : ''}
                      {submission.reviewedAt && submission.status !== 'submitted' ? ` · reviewed ${formatDate(submission.reviewedAt, true)}` : ''}
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
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {submission.status === 'accepted' ? 'Save — completed' : 'Mark completed'}
                    </Button>
                    <Button size="sm" variant="secondary" loading={busy} disabled={busy} onClick={() => handleReview(submission, 'needs_revision')}>
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      {submission.status === 'needs_revision' ? 'Save — needs changes' : 'Request changes'}
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
