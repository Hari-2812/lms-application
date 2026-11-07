import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  BookOpen,
  ClipboardList,
  Copy,
  CreditCard,
  ExternalLink,
  FolderOpen,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  Plus,
  ShieldOff,
  ShieldCheck,
  Trash2,
  User,
} from 'lucide-react';
import {
  enrolLearner,
  getAllResources,
  getCourses,
  getLearner,
  resetUserPassword,
  setLearnerFullAccess,
  setLearnerMaterials,
  setLearnerStatus,
  toErrorMessage,
  unenrolLearner,
} from '../../api/client';
import { usePageMeta } from '../../components/layout/DashboardLayout.jsx';
import Button from '../../components/common/Button.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  AccountStatus,
  AdminTabs,
  Alert,
  EmptyRow,
  Initials,
  LoadingRow,
  Panel,
  PaymentStatus,
  Pill,
  ProgressMeter,
  StatTile,
  Toggle,
  formatDate,
  formatMethod,
  formatMoney,
  timeAgo,
  useFlash,
} from '../../components/admin/ui.jsx';

const SUBMISSION_STATUS = {
  submitted: { label: 'Submitted', tone: 'blue' },
  under_review: { label: 'Under review', tone: 'blue' },
  accepted: { label: 'Accepted', tone: 'green' },
  needs_revision: { label: 'Needs revision', tone: 'amber' },
};

const SOURCE_LABEL = { payment: 'Paid', free: 'Free course', manual: 'Granted by admin', bulk: 'Bulk', full: 'Full Access' };

/** One learner's full record, and the Super Admin actions on it. */
export default function AdminLearnerDetail() {
  const { id } = useParams();
  const { isSuperAdmin } = useAuth();
  const flash = useFlash();

  const [record, setRecord] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('courses');
  const [enrolCourseId, setEnrolCourseId] = useState('');
  const [busy, setBusy] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [allResources, setAllResources] = useState(null);
  const [materialPicks, setMaterialPicks] = useState(null); // Set of resource ids while editing

  const load = useCallback(
    () =>
      getLearner(id)
        .then((data) => {
          setRecord(data);
          setLoadError('');
        })
        .catch((err) => setLoadError(toErrorMessage(err))),
    [id]
  );

  useEffect(() => {
    load();
    getCourses().then(setCourses).catch(() => {});
  }, [load]);

  // The material picker loads every resource the first time its tab opens.
  useEffect(() => {
    if (tab !== 'materials' || allResources) return;
    getAllResources()
      .then(setAllResources)
      .catch((err) => flash.error(toErrorMessage(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once, on first open
  }, [tab]);

  // Start each edit from what is saved.
  useEffect(() => {
    if (record) setMaterialPicks(new Set((record.materials || []).map((m) => String(m.resourceId))));
  }, [record]);

  usePageMeta(record ? record.learner.name : 'Learner', 'Learner record');

  const liveCourseIds = useMemo(
    () => new Set((record?.courses || []).filter((c) => c.live).map((c) => String(c.courseId))),
    [record]
  );
  const enrollable = courses.filter((c) => !liveCourseIds.has(String(c._id)));

  if (loadError) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Alert tone="error">{loadError}</Alert>
      </div>
    );
  }
  if (!record) return <div className="admin-card"><LoadingRow label="Loading learner…" /></div>;

  const { learner, enrollments, submissions, certificates } = record;
  const suspended = learner.status === 'suspended';
  const liveCourses = record.courses.filter((c) => c.live);
  const avgProgress = liveCourses.length
    ? Math.round(liveCourses.reduce((sum, c) => sum + c.progress, 0) / liveCourses.length)
    : 0;
  const paidTotal = enrollments.filter((e) => e.status === 'completed').reduce((sum, e) => sum + e.amount, 0);

  const run = async (key, action, message) => {
    setBusy(key);
    try {
      const result = await action();
      await load();
      flash.success(typeof message === 'function' ? message(result) : message);
      return result;
    } catch (err) {
      flash.error(toErrorMessage(err));
      return null;
    } finally {
      setBusy('');
    }
  };

  const toggleStatus = () => {
    if (suspended) {
      run('status', () => setLearnerStatus(learner.id, 'active'), `${learner.name} can sign in again.`);
      return;
    }
    const reason = window.prompt(`Suspend ${learner.name}? They are signed out and cannot sign in until re-activated.\n\nReason (optional):`, '');
    if (reason === null) return;
    run('status', () => setLearnerStatus(learner.id, 'suspended', reason), `${learner.name} is suspended.`);
  };

  const resetPassword = async (mode) => {
    if (mode === 'temporary' && !window.confirm(`Set a new one-time password for ${learner.name}? Their current password stops working.`)) return;
    setTempPassword('');
    const result = await run('reset', () => resetUserPassword(learner.id, mode), (r) => r.message);
    if (result?.temporaryPassword) setTempPassword(result.temporaryPassword);
  };

  const enrol = (event) => {
    event.preventDefault();
    if (!enrolCourseId) return;
    const course = courses.find((c) => c._id === enrolCourseId);
    run('enrol', () => enrolLearner(learner.id, enrolCourseId), `${learner.name} is enrolled in "${course?.title}" and has been notified.`).then(
      (ok) => ok && setEnrolCourseId('')
    );
  };

  const removeAccess = (course) => {
    if (!window.confirm(`Remove ${learner.name}'s access to "${course.title}"? Their progress is kept.`)) return;
    run(`remove-${course.courseId}`, () => unenrolLearner(learner.id, course.courseId), `Access to "${course.title}" removed.`);
  };

  const toggleFullAccess = (enabled) => {
    const message = enabled
      ? `Give ${learner.name} Full Access? They can open every published course and material, including courses added later.`
      : `End ${learner.name}'s Full Access? Courses they paid for or were given individually stay available.`;
    if (!window.confirm(message)) return;
    run(
      'full',
      () => setLearnerFullAccess(learner.id, enabled),
      enabled ? `${learner.name} now has Full Access and has been notified.` : `Full Access ended for ${learner.name}.`
    );
  };

  const saveMaterials = () =>
    run('materials', () => setLearnerMaterials(learner.id, [...materialPicks]), (r) =>
      r.added || r.removed
        ? `Shared materials updated: ${r.added} added, ${r.removed} removed. ${r.added ? 'The learner has been notified.' : ''}`
        : 'No changes to save.'
    );

  const togglePick = (id) =>
    setMaterialPicks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const savedPicks = new Set((record.materials || []).map((m) => String(m.resourceId)));
  const picksChanged =
    materialPicks && (materialPicks.size !== savedPicks.size || [...materialPicks].some((id) => !savedPicks.has(id)));

  const tabs = [
    { value: 'courses', label: 'Courses & progress', icon: BookOpen, count: liveCourses.length },
    { value: 'materials', label: 'Shared materials', icon: FolderOpen, count: record.materials?.length || 0 },
    { value: 'payments', label: 'Payments', icon: CreditCard, count: enrollments.length },
    { value: 'tasks', label: 'Task submissions', icon: ClipboardList, count: submissions.length },
    { value: 'certificates', label: 'Certificates', icon: Award, count: certificates.length },
  ];

  return (
    <div className="space-y-6">
      <BackLink />
      {flash.node}

      {/* --- profile ------------------------------------------------------ */}
      <section className="admin-card">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <Initials name={learner.name} size="lg" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold text-ink-900">{learner.name}</h1>
                  <AccountStatus status={learner.status} />
                </div>
                <p className="text-[13px] text-ink-500">{learner.headline || 'Learner'}</p>
              </div>
            </div>

            {isSuperAdmin && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" loading={busy === 'reset'} onClick={() => resetPassword('link')}>
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  Email reset link
                </Button>
                <Button size="sm" variant="secondary" loading={busy === 'reset'} onClick={() => resetPassword('temporary')}>
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  Temporary password
                </Button>
                <Button size="sm" variant={suspended ? 'primary' : 'danger'} loading={busy === 'status'} onClick={toggleStatus}>
                  {suspended ? <ShieldCheck className="h-4 w-4" aria-hidden="true" /> : <ShieldOff className="h-4 w-4" aria-hidden="true" />}
                  {suspended ? 'Activate account' : 'Suspend account'}
                </Button>
              </div>
            )}
          </div>

          {tempPassword && (
            <Alert tone="success" className="mt-5" onClose={() => setTempPassword('')}>
              One-time password for {learner.name}:{' '}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[13px] font-semibold text-ink-900">{tempPassword}</code>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(tempPassword)}
                className="ml-2 inline-flex items-center gap-1 text-[12px] font-semibold underline"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copy
              </button>
              <span className="mt-1 block text-[12px]">It is shown only once. Ask them to change it after signing in.</span>
            </Alert>
          )}

          {suspended && (
            <Alert tone="error" className="mt-5">
              Suspended {formatDate(learner.suspendedAt, true)}
              {learner.suspendedReason ? ` — ${learner.suspendedReason}` : ''}. The learner cannot sign in.
            </Alert>
          )}

          <dl className="mt-6 grid gap-4 border-t border-ink-100 pt-5 sm:grid-cols-2 xl:grid-cols-4">
            <Detail icon={Mail} label="Email">
              <a href={`mailto:${learner.email}`} className="hover:text-primary-700">{learner.email}</a>
            </Detail>
            <Detail icon={Phone} label="Phone">
              {learner.phone ? <a href={`tel:${learner.phone}`} className="hover:text-primary-700">{learner.phone}</a> : 'Not provided'}
            </Detail>
            <Detail icon={MapPin} label="City">{learner.city || 'Not provided'}</Detail>
            <Detail icon={User} label="Joined">
              {formatDate(learner.createdAt)}
              {learner.lastLoginAt ? ` · last sign-in ${timeAgo(learner.lastLoginAt)}` : ''}
            </Detail>
          </dl>
          {learner.bio && <p className="mt-4 rounded-lg bg-ink-50 p-3.5 text-[13px] leading-relaxed text-ink-700">{learner.bio}</p>}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile featured icon={BookOpen} label="Courses enrolled" value={liveCourses.length} />
        <StatTile icon={BookOpen} label="Average progress" value={`${avgProgress}%`} />
        <StatTile icon={CreditCard} tone="green" label="Total paid" value={formatMoney(paidTotal)} />
        <StatTile icon={ClipboardList} label="Task submissions" value={submissions.length} />
      </section>

      <AdminTabs tabs={tabs} value={tab} onChange={setTab} />

      {/* --- courses -------------------------------------------------------- */}
      {tab === 'courses' && (
        <Panel
          title="Course access"
          description="Full Access opens every course and material. Otherwise grant courses one at a time below (Limited Access), share individual materials from the Shared materials tab, or let the learner buy a course — a successful payment unlocks it automatically."
        >
          <Toggle
            id="full-access"
            label="Full Access — all courses and materials"
            description={
              learner.fullAccess
                ? `On since ${formatDate(learner.fullAccessGrantedAt)}. Includes courses added later.`
                : 'Off. The learner can open only the courses listed below.'
            }
            checked={Boolean(learner.fullAccess)}
            disabled={!isSuperAdmin || busy === 'full'}
            onChange={toggleFullAccess}
          />
        </Panel>
      )}

      {tab === 'courses' && (
        <Panel icon={BookOpen} title="Enrolled courses & progress" bodyClassName="">
          {isSuperAdmin && (
            <form onSubmit={enrol} className="flex flex-col gap-3 border-b border-ink-100 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
              <label htmlFor="enrol-course" className="text-[13px] font-semibold text-primary-800">
                Manually enrol in
              </label>
              <select
                id="enrol-course"
                className="admin-field sm:w-80"
                value={enrolCourseId}
                onChange={(e) => setEnrolCourseId(e.target.value)}
              >
                <option value="">Choose a course…</option>
                {enrollable.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.title}
                    {c.published === false ? ' (draft)' : ''}
                  </option>
                ))}
              </select>
              <Button type="submit" size="sm" disabled={!enrolCourseId} loading={busy === 'enrol'}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Enrol &amp; notify
              </Button>
            </form>
          )}

          {record.courses.length === 0 ? (
            <EmptyRow icon={BookOpen} title="Not enrolled in any course yet" />
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-table min-w-[48rem]">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th className="w-56">Progress</th>
                    <th>Lessons</th>
                    <th>Last activity</th>
                    <th>Access</th>
                    <th>Certificate</th>
                    {isSuperAdmin && <th className="text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {record.courses.map((course) => (
                    <tr key={course.courseId}>
                      <td className="font-medium text-ink-900">{course.title}</td>
                      <td>
                        <ProgressMeter value={course.progress} label={`${course.title} progress`} />
                      </td>
                      <td className="tabular-nums">
                        {course.completedLessons}/{course.lessonCount}
                      </td>
                      <td className="text-[13px]">{timeAgo(course.lastActivity)}</td>
                      <td>
                        <div className="flex flex-col gap-1">
                          {course.live ? (
                            <Pill tone="green">{SOURCE_LABEL[course.source] || 'Active'}</Pill>
                          ) : course.active ? (
                            <Pill tone="amber">Expired</Pill>
                          ) : (
                            <Pill tone="gray">Removed</Pill>
                          )}
                          <span className="text-[11px] text-ink-400">
                            {course.expiresAt ? `until ${formatDate(course.expiresAt)}` : `since ${formatDate(course.grantedAt)}`}
                          </span>
                        </div>
                      </td>
                      <td className="font-mono text-[12px]">{course.certificateSerial || '—'}</td>
                      {isSuperAdmin && (
                        <td className="text-right">
                          {course.source === 'full' ? (
                            <span className="text-[12px] text-ink-400">Via Full Access</span>
                          ) : course.live ? (
                            <button
                              type="button"
                              onClick={() => removeAccess(course)}
                              disabled={busy === `remove-${course.courseId}`}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Remove
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => run(`enrol-${course.courseId}`, () => enrolLearner(learner.id, course.courseId), `Access to "${course.title}" restored.`)}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-primary-700 transition hover:bg-primary-50"
                            >
                              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Restore
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {/* --- shared materials ------------------------------------------------- */}
      {tab === 'materials' && (
        <Panel
          icon={FolderOpen}
          title="Shared learning materials"
          description="Limited Access to materials: tick individual study materials to share with this learner without giving them the whole course. They appear in the learner's Resources page."
          actions={
            isSuperAdmin && (
              <Button size="sm" onClick={saveMaterials} loading={busy === 'materials'} disabled={!picksChanged}>
                Save shared materials
              </Button>
            )
          }
          bodyClassName=""
        >
          {learner.fullAccess && (
            <Alert tone="info" className="mx-5 mt-4 sm:mx-6">
              {learner.name} has Full Access, so every material is already available. Shares saved here only matter if Full Access is turned off.
            </Alert>
          )}
          {!allResources ? (
            <LoadingRow label="Loading materials…" />
          ) : allResources.length === 0 ? (
            <EmptyRow icon={FolderOpen} title="No study materials yet" description="Add them from Courses → Add study material." />
          ) : (
            <div className="divide-y divide-ink-100">
              {Object.values(
                allResources.reduce((groups, r) => {
                  const key = String(r.courseId);
                  (groups[key] ||= { courseId: key, title: r.courseTitle, items: [] }).items.push(r);
                  return groups;
                }, {})
              ).map((group) => {
                const included = liveCourseIds.has(group.courseId);
                return (
                  <div key={group.courseId} role="group" aria-labelledby={`materials-${group.courseId}`} className="px-5 py-4 sm:px-6">
                    <p id={`materials-${group.courseId}`} className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink-900">
                      {group.title}
                      {included && <Pill tone="green">Has this course — all materials included</Pill>}
                    </p>
                    <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                      {group.items.map((r) => {
                        const id = String(r.id || r._id);
                        return (
                          <li key={id}>
                            <label className={`flex items-start gap-2.5 rounded-lg border p-3 text-[13px] transition ${materialPicks?.has(id) ? 'border-primary-300 bg-primary-50/60' : 'border-ink-200'} ${included || !isSuperAdmin ? 'opacity-60' : 'cursor-pointer hover:border-primary-300'}`}>
                              <input
                                type="checkbox"
                                className="mt-0.5 h-4 w-4 rounded border-ink-300 text-primary-600"
                                checked={Boolean(materialPicks?.has(id))}
                                disabled={!isSuperAdmin}
                                onChange={() => togglePick(id)}
                              />
                              <span className="min-w-0">
                                <span className="block font-medium text-ink-900">{r.title}</span>
                                <span className="block text-[11.5px] uppercase tracking-wide text-ink-400">{r.type}</span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      )}

      {/* --- payments ------------------------------------------------------- */}
      {tab === 'payments' && (
        <Panel
          icon={CreditCard}
          title="Payment history"
          actions={
            <Button to={`/admin/payments?studentId=${learner.id}&includeFree=true`} size="sm" variant="secondary">
              Open in Payments
            </Button>
          }
          bodyClassName=""
        >
          {enrollments.length === 0 ? (
            <EmptyRow icon={CreditCard} title="No payments or enrolments yet" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {enrollments.map((payment) => (
                <li key={payment._id} className="px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink-900">{payment.courseId?.title || 'Deleted course'}</p>
                      <p className="mt-0.5 font-mono text-[12px] text-ink-500">{payment.transactionId}</p>
                      <p className="mt-1 text-[12.5px] text-ink-600">
                        {payment.amount > 0 ? formatMoney(payment.amount) : 'Free'} · {formatMethod(payment.method)} ·{' '}
                        {formatDate(payment.createdAt, true)}
                        {payment.reference ? ` · ref ${payment.reference}` : ''}
                      </p>
                      {payment.failureReason && <p className="mt-1 text-[12px] text-red-600">{payment.failureReason}</p>}
                    </div>
                    <PaymentStatus status={payment.status} />
                  </div>
                  {payment.history?.length > 0 && (
                    <ol className="mt-3 space-y-1.5 border-l-2 border-ink-200 pl-4">
                      {payment.history.map((step, index) => (
                        <li key={index} className="text-[12px] text-ink-600">
                          <span className="font-semibold text-primary-800">{formatDate(step.at, true)}</span> — {step.note || step.status}
                        </li>
                      ))}
                    </ol>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {/* --- tasks ---------------------------------------------------------- */}
      {tab === 'tasks' && (
        <Panel
          icon={ClipboardList}
          title="Task-submission history"
          actions={<Button to="/admin/tasks" size="sm" variant="secondary">Review queue</Button>}
          bodyClassName=""
        >
          {submissions.length === 0 ? (
            <EmptyRow icon={ClipboardList} title="No submissions yet" />
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-table min-w-[44rem]">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Course</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th>Score</th>
                    <th className="text-right">Work</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s) => {
                    const meta = SUBMISSION_STATUS[s.status] || SUBMISSION_STATUS.submitted;
                    return (
                      <tr key={s.id}>
                        <td>
                          <p className="font-medium text-ink-900">{s.assignmentId?.title || s.title || s.category}</p>
                          {s.feedback && <p className="mt-0.5 line-clamp-1 text-[12px] text-ink-500">“{s.feedback}”</p>}
                        </td>
                        <td className="text-[13px]">{s.courseId?.title || '—'}</td>
                        <td className="whitespace-nowrap text-[13px]">{formatDate(s.createdAt)}</td>
                        <td><Pill tone={meta.tone}>{meta.label}</Pill></td>
                        <td className="tabular-nums">
                          {s.score !== null && s.score !== undefined ? `${s.score}/${s.assignmentId?.maxScore || 100}` : '—'}
                        </td>
                        <td className="text-right">
                          <a href={s.driveLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary-700 hover:text-primary-800">
                            Open <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {/* --- certificates ---------------------------------------------------- */}
      {tab === 'certificates' && (
        <Panel icon={Award} title="Certificates earned" bodyClassName="">
          {certificates.length === 0 ? (
            <EmptyRow icon={Award} title="No certificates yet" description="Issued automatically when the learner meets the completion criteria." />
          ) : (
            <ul className="divide-y divide-ink-100">
              {certificates.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{c.courseTitle}</p>
                    <p className="font-mono text-[12px] text-ink-500">{c.serial} · issued {formatDate(c.issuedAt)}</p>
                  </div>
                  <Button to={`/admin/certificates?search=${encodeURIComponent(c.serial)}`} size="sm" variant="secondary">
                    View &amp; download
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/admin/learners" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary-700 hover:text-primary-800">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      All learners
    </Link>
  );
}

function Detail({ icon: Icon, label, children }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-[12px] text-ink-500">{label}</dt>
        <dd className="mt-0.5 break-words text-[13.5px] text-ink-800">{children}</dd>
      </div>
    </div>
  );
}
