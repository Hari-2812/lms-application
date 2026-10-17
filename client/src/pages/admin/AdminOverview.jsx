import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  CreditCard,
  History,
  IndianRupee,
  LayoutDashboard,
  TriangleAlert,
  UserPlus,
  Users,
} from 'lucide-react';
import { getAdminOverview, getCourseStats, toErrorMessage } from '../../api/client';
import { usePageMeta } from '../../components/layout/DashboardLayout.jsx';
import Button from '../../components/common/Button.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  Alert,
  EmptyRow,
  Initials,
  LoadingRow,
  PageHeader,
  Panel,
  PaymentStatus,
  StatTile,
  formatMoney,
  timeAgo,
} from '../../components/admin/ui.jsx';

/** Admin home: the headline numbers and what changed recently. */
export default function AdminOverview() {
  const { student, isSuperAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [stats, setStats] = useState([]);
  const [error, setError] = useState('');

  usePageMeta('Dashboard', 'Everything happening across the platform.');

  useEffect(() => {
    Promise.all([getAdminOverview(), getCourseStats()])
      .then(([overview, courseStats]) => {
        setData(overview);
        setStats(courseStats);
      })
      .catch((err) => setError(toErrorMessage(err)));
  }, []);

  const firstName = (student?.name || '').split(' ')[0];
  const maxEnrolled = Math.max(1, ...stats.map((s) => s.enrolledCount));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title={`Welcome back${firstName ? `, ${firstName}` : ''}`}
        description="Learners, payments, reviews and certificates at a glance."
        actions={
          <>
            <Button to="/admin/learners" variant="secondary" size="sm">
              <Users className="h-4 w-4" aria-hidden="true" />
              Learners
            </Button>
            <Button to="/admin/notifications" size="sm">
              Send notification
            </Button>
          </>
        }
      />

      <Alert tone="error">{error}</Alert>

      {!data ? (
        !error && <div className="admin-card"><LoadingRow label="Loading dashboard…" /></div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              featured
              icon={IndianRupee}
              label="Revenue (successful payments)"
              value={formatMoney(data.payments.successfulAmount)}
              hint={`${formatMoney(data.payments.monthAmount)} this month`}
              to="/admin/payments?status=completed"
            />
            <StatTile
              icon={Users}
              label="Registered learners"
              value={data.learners.total}
              hint={`${data.learners.newThisMonth} new this month${data.learners.suspended ? ` · ${data.learners.suspended} suspended` : ''}`}
              to="/admin/learners"
            />
            <StatTile
              icon={CreditCard}
              tone={data.payments.pendingCount ? 'amber' : 'soft'}
              label="Pending payments"
              value={data.payments.pendingCount}
              hint={
                data.payments.failedCount
                  ? `${data.payments.failedCount} failed · ${formatMoney(data.payments.pendingAmount)} pending`
                  : `${formatMoney(data.payments.pendingAmount)} awaiting confirmation`
              }
              to="/admin/payments?status=pending"
            />
            <StatTile
              icon={ClipboardCheck}
              tone={data.awaitingReview ? 'amber' : 'soft'}
              label="Tasks awaiting review"
              value={data.awaitingReview}
              to="/admin/tasks"
            />
            <StatTile
              icon={BookOpen}
              label="Courses"
              value={data.courses.total}
              hint={`${data.courses.published} published`}
              to={isSuperAdmin ? '/admin/courses' : undefined}
            />
            <StatTile icon={Award} tone="green" label="Certificates issued" value={data.certificates} to="/admin/certificates" />
            <StatTile
              icon={TriangleAlert}
              tone={data.payments.failedCount ? 'red' : 'soft'}
              label="Failed payments"
              value={data.payments.failedCount}
              to="/admin/payments?status=failed"
            />
            <StatTile
              icon={UserPlus}
              label="New learners this month"
              value={data.learners.newThisMonth}
              to="/admin/learners"
            />
          </section>

          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <Panel icon={BarChart3} title="Enrolment by course" description="Learners with live access to each course.">
              {stats.length === 0 ? (
                <p className="text-sm text-ink-500">No courses yet.</p>
              ) : (
                <ul className="space-y-4">
                  {stats.map((stat) => (
                    <li key={stat.courseId}>
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                        <span className="truncate font-medium text-ink-800">{stat.title}</span>
                        <span className="shrink-0 font-semibold tabular-nums text-primary-700">{stat.enrolledCount}</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-primary-50">
                        <div
                          className="h-full rounded-full bg-primary-600"
                          style={{ width: `${Math.max(3, (stat.enrolledCount / maxEnrolled) * 100)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel
              icon={UserPlus}
              title="Newest learners"
              actions={<Link to="/admin/learners" className="text-[13px] font-semibold text-primary-700 hover:text-primary-800">View all</Link>}
              bodyClassName=""
            >
              {data.recentLearners.length === 0 ? (
                <EmptyRow icon={Users} title="No learners yet" />
              ) : (
                <ul className="divide-y divide-ink-100">
                  {data.recentLearners.map((learner) => (
                    <li key={learner.id}>
                      <Link to={`/admin/learners/${learner.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-ink-50/60 sm:px-6">
                        <Initials name={learner.name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink-900">{learner.name}</p>
                          <p className="truncate text-xs text-ink-500">{learner.email}</p>
                        </div>
                        <span className="shrink-0 text-[11px] text-ink-400">{timeAgo(learner.createdAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Panel
              icon={CreditCard}
              title="Latest payments"
              actions={<Link to="/admin/payments" className="text-[13px] font-semibold text-primary-700 hover:text-primary-800">All payments</Link>}
              bodyClassName=""
            >
              {data.recentPayments.length === 0 ? (
                <EmptyRow icon={CreditCard} title="No payments yet" description="They appear when a learner checks out a paid course." />
              ) : (
                <ul className="divide-y divide-ink-100">
                  {data.recentPayments.map((payment) => (
                    <li key={payment._id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink-900">
                          {payment.studentId?.name || 'Deleted account'}
                          <span className="font-normal text-ink-500"> · {payment.courseId?.title || 'Deleted course'}</span>
                        </p>
                        <p className="text-xs text-ink-500">
                          {formatMoney(payment.amount)} · {timeAgo(payment.updatedAt)}
                        </p>
                      </div>
                      <PaymentStatus status={payment.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel
              icon={History}
              title="Recent activity"
              actions={
                isSuperAdmin && (
                  <Link to="/admin/activity" className="text-[13px] font-semibold text-primary-700 hover:text-primary-800">
                    Activity log
                  </Link>
                )
              }
              bodyClassName=""
            >
              {data.recentActivity.length === 0 ? (
                <EmptyRow icon={History} title="Nothing logged yet" />
              ) : (
                <ul className="divide-y divide-ink-100">
                  {data.recentActivity.map((entry) => (
                    <li key={entry.id} className="px-5 py-3 sm:px-6">
                      <p className="text-[13px] text-ink-800">{entry.summary}</p>
                      <p className="mt-0.5 text-[11px] text-ink-400">
                        {entry.actorName} · {timeAgo(entry.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
