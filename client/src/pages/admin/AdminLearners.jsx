import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, Search, UserCheck, Users, UserX } from 'lucide-react';
import { getCourses, getLearners, toErrorMessage } from '../../api/client';
import { usePageMeta } from '../../components/layout/DashboardLayout.jsx';
import {
  AccountStatus,
  Alert,
  EmptyRow,
  FilterBar,
  FilterField,
  Initials,
  LoadingRow,
  PageHeader,
  Panel,
  Pill,
  ProgressMeter,
  StatTile,
  formatDate,
  formatMoney,
  timeAgo,
} from '../../components/admin/ui.jsx';

const PROGRESS_OPTIONS = [
  ['not_enrolled', 'No course yet'],
  ['not_started', 'Not started'],
  ['in_progress', 'In progress'],
  ['completed', 'Completed all courses'],
];

const TASK_OPTIONS = [
  ['pending', 'Has tasks to submit'],
  ['overdue', 'Has overdue tasks'],
  ['all_done', 'Submitted every task'],
  ['awaiting_review', 'Waiting for review'],
  ['needs_revision', 'Needs changes'],
  ['none_submitted', 'Never submitted'],
];

const ACCESS_OPTIONS = [
  ['full', 'Full Access'],
  ['courses', 'Selected courses'],
  ['materials', 'Shared materials'],
  ['none', 'No access yet'],
];

/**
 * Admin → Learners: every registered learner with contact details, access,
 * progress, tasks and payment state. Filterable by course, access type,
 * progress (not started / in progress / completed), task status (pending,
 * overdue, waiting for review…), account status and payment status — e.g.
 * "learners in Python with overdue tasks". Clicking a row opens the record.
 */
export default function AdminLearners() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [learners, setLearners] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState(params.get('search') || '');

  usePageMeta('Learners', 'Registered learners, their access and progress.');

  const filters = {
    search: params.get('search') || '',
    courseId: params.get('courseId') || '',
    status: params.get('status') || '',
    payment: params.get('payment') || '',
    access: params.get('access') || '',
    progress: params.get('progress') || '',
    tasks: params.get('tasks') || '',
  };

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  useEffect(() => {
    getCourses().then(setCourses).catch(() => {});
  }, []);

  // Debounce typing into the search box before it becomes a URL param.
  useEffect(() => {
    const id = setTimeout(() => {
      if (query !== filters.search) setFilter('search', query.trim());
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed text drives this
  }, [query]);

  useEffect(() => {
    setLoading(true);
    const active = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    getLearners(active)
      .then((rows) => {
        setLearners(rows);
        setError('');
      })
      .catch((err) => setError(toErrorMessage(err)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the URL params are the dependency
  }, [params]);

  const totals = useMemo(
    () => ({
      total: learners.length,
      active: learners.filter((l) => l.status !== 'suspended').length,
      suspended: learners.filter((l) => l.status === 'suspended').length,
      enrolled: learners.filter((l) => l.fullAccess || l.courseCount > 0).length,
      overdue: learners.filter((l) => l.tasksOverdue > 0).length,
      completed: learners.filter((l) => l.progressState === 'completed').length,
    }),
    [learners]
  );

  const filtered = Object.values(filters).some(Boolean);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title="Learner management"
        description="Profiles, access, progress, tasks and payments for every registered learner. Use the filters to find, for example, learners who have not started, or who have overdue tasks."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile featured icon={Users} label={filtered ? 'Matching learners' : 'Registered learners'} value={totals.total} hint={totals.suspended ? `${totals.suspended} suspended` : undefined} />
        <StatTile icon={UserCheck} tone="green" label="With course access" value={totals.enrolled} />
        <StatTile icon={Users} label="Completed their courses" value={totals.completed} />
        <StatTile icon={UserX} tone={totals.overdue ? 'amber' : undefined} label="With overdue tasks" value={totals.overdue} />
      </section>

      <Alert tone="error">{error}</Alert>

      <Panel icon={Users} title="All learners" description="Search by name, email or phone." bodyClassName="">
        <FilterBar>
          <FilterField label="Search" className="lg:flex-1">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-400" aria-hidden="true" />
              <input
                type="search"
                className="admin-field w-full pl-9"
                placeholder="Name, email or phone"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </FilterField>
          <FilterField label="Course" className="lg:w-56">
            <select className="admin-field" value={filters.courseId} onChange={(e) => setFilter('courseId', e.target.value)}>
              <option value="">All courses</option>
              {courses.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.title}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Access" className="lg:w-44">
            <select className="admin-field" value={filters.access} onChange={(e) => setFilter('access', e.target.value)}>
              <option value="">Any access</option>
              {ACCESS_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </FilterField>
          <FilterField label={filters.courseId ? 'Progress in this course' : 'Progress'} className="lg:w-48">
            <select className="admin-field" value={filters.progress} onChange={(e) => setFilter('progress', e.target.value)}>
              <option value="">Any progress</option>
              {PROGRESS_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Tasks" className="lg:w-48">
            <select className="admin-field" value={filters.tasks} onChange={(e) => setFilter('tasks', e.target.value)}>
              <option value="">Any task status</option>
              {TASK_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Account status" className="lg:w-44">
            <select className="admin-field" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
              <option value="">Any status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </FilterField>
          <FilterField label="Payment status" className="lg:w-48">
            <select className="admin-field" value={filters.payment} onChange={(e) => setFilter('payment', e.target.value)}>
              <option value="">Any</option>
              <option value="paid">Has paid</option>
              <option value="pending">Payment pending</option>
              <option value="failed">Payment failed</option>
              <option value="none">No payments</option>
            </select>
          </FilterField>
          {filtered && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setParams({}, { replace: true });
              }}
              className="h-10 self-start rounded-lg px-3 text-[13px] font-semibold text-primary-700 transition hover:bg-primary-50 lg:self-end"
            >
              Clear filters
            </button>
          )}
        </FilterBar>

        {loading ? (
          <LoadingRow label="Loading learners…" />
        ) : learners.length === 0 ? (
          <EmptyRow
            icon={Users}
            title={filtered ? 'No learners match these filters' : 'No learners have registered yet'}
            description={filtered ? 'Try a different search or clear the filters.' : 'New sign-ups appear here straight away.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table min-w-[68rem]">
              <thead>
                <tr>
                  <th>Learner</th>
                  <th>Contact</th>
                  <th>Access</th>
                  <th className="w-44">{filters.courseId ? 'Progress (this course)' : 'Progress'}</th>
                  <th>Tasks</th>
                  <th>Payments</th>
                  <th>Joined</th>
                  <th>Status</th>
                  <th className="text-right">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {learners.map((learner) => (
                  <tr key={learner.id} className="cursor-pointer" onClick={() => navigate(`/admin/learners/${learner.id}`)}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Initials name={learner.name} size="sm" />
                        <div className="min-w-0">
                          <Link
                            to={`/admin/learners/${learner.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="block truncate font-semibold text-ink-900 hover:text-primary-700"
                          >
                            {learner.name}
                          </Link>
                          <p className="text-[11.5px] text-ink-400">
                            {learner.lastActiveAt ? `Active ${timeAgo(learner.lastActiveAt)}` : 'No activity yet'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <p className="truncate text-[13px] text-ink-800">{learner.email}</p>
                      <p className="text-[12px] text-ink-500">{learner.phone || 'No phone'}</p>
                    </td>
                    <td>
                      {learner.fullAccess ? (
                        <Pill tone="blue">Full Access</Pill>
                      ) : (
                        <div className="text-[13px]">
                          <span className="font-semibold tabular-nums text-primary-700">{learner.courseCount}</span>
                          <span className="text-ink-400"> course{learner.courseCount === 1 ? '' : 's'}</span>
                          {learner.materialCount > 0 && (
                            <p className="text-[11.5px] text-ink-500">+ {learner.materialCount} shared material{learner.materialCount === 1 ? '' : 's'}</p>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      {learner.progressState === 'not_enrolled' ? (
                        <span className="text-[12.5px] text-ink-400">—</span>
                      ) : (
                        <>
                          <ProgressMeter value={learner.progressPercent} label={`${learner.name} progress`} />
                          <p className="mt-1 text-[11.5px] text-ink-500">
                            {learner.completedLessons}/{learner.totalLessons} lessons
                            {learner.coursesCompleted > 0 ? ` · ${learner.coursesCompleted} done` : ''}
                          </p>
                        </>
                      )}
                    </td>
                    <td>
                      {learner.tasksAssigned > 0 ? (
                        <div className="flex flex-col items-start gap-1">
                          <span className="text-[13px] tabular-nums text-ink-800">
                            {learner.tasksSubmitted}/{learner.tasksAssigned} submitted
                          </span>
                          {learner.tasksOverdue > 0 && <Pill tone="red">{learner.tasksOverdue} overdue</Pill>}
                          {learner.awaitingReview > 0 && <Pill tone="blue">{learner.awaitingReview} to review</Pill>}
                          {learner.needsRevision > 0 && <Pill tone="amber">{learner.needsRevision} needs revision</Pill>}
                        </div>
                      ) : (
                        <span className="text-[12.5px] text-ink-400">
                          {learner.submissionCount ? `${learner.submissionCount} submitted` : 'No tasks'}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        {learner.paidCount > 0 && <Pill tone="green">{formatMoney(learner.paidTotal)} paid</Pill>}
                        {learner.pendingPayments > 0 && <Pill tone="amber">{learner.pendingPayments} pending</Pill>}
                        {learner.failedPayments > 0 && <Pill tone="red">{learner.failedPayments} failed</Pill>}
                        {learner.paidCount + learner.pendingPayments + learner.failedPayments === 0 && (
                          <span className="text-[12.5px] text-ink-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-[13px]">{formatDate(learner.createdAt)}</td>
                    <td>
                      <AccountStatus status={learner.status} />
                    </td>
                    <td className="text-right">
                      <ChevronRight className="ml-auto h-4 w-4 text-primary-300" aria-hidden="true" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
