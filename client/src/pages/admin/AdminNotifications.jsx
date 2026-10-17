import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  Bell,
  CheckCheck,
  ClipboardCheck,
  CreditCard,
  Inbox,
  Megaphone,
  Send,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { usePageMeta } from '../../components/layout/DashboardLayout.jsx';
import Button from '../../components/common/Button.jsx';
import NotificationComposer from '../../components/admin/NotificationComposer.jsx';
import { useNotifications } from '../../context/NotificationContext.jsx';
import { AdminTabs, EmptyRow, PageHeader, Panel, formatDate, timeAgo } from '../../components/admin/ui.jsx';

/**
 * Admin → Notifications.
 *
 * Inbox: what the admin team is told about — new learners, payments
 * (received / pending / failed), tasks awaiting review, enrolments and
 * certificates — with read state and full history.
 * Send: the composer for messages to learners.
 */

const TYPES = {
  learner_registered: { icon: UserPlus, tone: 'bg-primary-50 text-primary-600', label: 'New learner', group: 'learners' },
  enrollment: { icon: UserCheck, tone: 'bg-emerald-50 text-emerald-600', label: 'Enrolment', group: 'learners' },
  payment: { icon: CreditCard, tone: 'bg-amber-50 text-amber-600', label: 'Payment', group: 'payments' },
  submission: { icon: ClipboardCheck, tone: 'bg-violet-50 text-violet-600', label: 'Task', group: 'tasks' },
  task: { icon: ClipboardCheck, tone: 'bg-violet-50 text-violet-600', label: 'Task', group: 'tasks' },
  certificate: { icon: Award, tone: 'bg-amber-50 text-amber-600', label: 'Certificate', group: 'certificates' },
};
const FALLBACK = { icon: Megaphone, tone: 'bg-ink-100 text-ink-600', label: 'Update', group: 'other' };

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'learners', label: 'Learners' },
  { value: 'payments', label: 'Payments' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'certificates', label: 'Certificates' },
];

export default function AdminNotifications() {
  const { notifications, unreadCount, markRead, markAllRead, loadMore, hasMore, loadingMore } = useNotifications();
  const navigate = useNavigate();
  const [view, setView] = useState('inbox');
  const [filter, setFilter] = useState('all');

  usePageMeta('Notifications', 'Your alerts, and messages to learners.');

  const counts = useMemo(() => {
    const tally = { all: notifications.length, unread: unreadCount, learners: 0, payments: 0, tasks: 0, certificates: 0 };
    for (const n of notifications) {
      const group = (TYPES[n.type] || FALLBACK).group;
      if (group in tally) tally[group] += 1;
    }
    return tally;
  }, [notifications, unreadCount]);

  const visible = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter((n) => !n.read);
    return notifications.filter((n) => (TYPES[n.type] || FALLBACK).group === filter);
  }, [notifications, filter]);

  const open = (n) => {
    if (!n.read) markRead(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Bell}
        title="Notifications"
        description="Alerts for the admin team, and announcements, dues reminders and updates for learners — delivered to their bell in real time."
      />

      <AdminTabs
        value={view}
        onChange={setView}
        tabs={[
          { value: 'inbox', label: 'Admin inbox', icon: Inbox, count: unreadCount },
          { value: 'send', label: 'Send to learners', icon: Send },
        ]}
      />

      {view === 'send' ? (
        <NotificationComposer />
      ) : (
        <Panel
          icon={Inbox}
          title="Admin inbox"
          description={unreadCount ? `${unreadCount} unread` : 'You are all caught up.'}
          actions={
            unreadCount > 0 && (
              <Button size="sm" variant="secondary" onClick={markAllRead}>
                <CheckCheck className="h-4 w-4" aria-hidden="true" />
                Mark all read
              </Button>
            )
          }
          bodyClassName=""
        >
          <div className="border-b border-ink-100 px-5 py-3 sm:px-6">
            <AdminTabs tabs={FILTERS.map((f) => ({ ...f, count: counts[f.value] }))} value={filter} onChange={setFilter} />
          </div>

          {visible.length === 0 ? (
            <EmptyRow
              icon={Bell}
              title={filter === 'all' ? 'No notifications yet' : 'Nothing here'}
              description="New learners, payments, task submissions, enrolments and certificates show up here."
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {visible.map((n) => {
                const { icon: Icon, tone, label } = TYPES[n.type] || FALLBACK;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => open(n)}
                      className={`flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-ink-50/60 sm:px-6 ${n.read ? '' : 'bg-primary-50/40'}`}
                    >
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone}`}>
                        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary-600" aria-label="Unread" />}
                          <p className="truncate text-sm font-semibold text-ink-900">{n.title}</p>
                        </div>
                        <p className="mt-0.5 text-[13px] leading-relaxed text-ink-600">{n.message}</p>
                        <p className="mt-1 text-[11px] text-ink-400" title={formatDate(n.createdAt, true)}>
                          {label} · {timeAgo(n.createdAt)}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {hasMore && (
            <div className="border-t border-ink-100 p-4 text-center">
              <Button size="sm" variant="soft" loading={loadingMore} onClick={loadMore}>
                Load older notifications
              </Button>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
