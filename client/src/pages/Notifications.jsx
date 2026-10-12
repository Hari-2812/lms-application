import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  Bell,
  BookOpen,
  CalendarClock,
  CheckCheck,
  CreditCard,
  ListChecks,
  Lock,
  Megaphone,
  RefreshCw,
  Trophy,
  Unlock,
} from 'lucide-react';
import { usePageMeta } from '../components/layout/DashboardLayout.jsx';
import Button from '../components/common/Button.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import Tabs from '../components/common/Tabs.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';

/**
 * The full notification history, behind the bell icon's "View all".
 *
 * The bell dropdown shows the newest few; this page groups everything by day
 * and lets the student filter by what kind of update it is. Both read from
 * the same NotificationContext, so a notification marked read here is marked
 * read in the bell immediately.
 */

/** Icon and colour per notification type. */
const TYPES = {
  access_granted: { icon: Unlock, tone: 'bg-emerald-50 text-emerald-600', label: 'Access' },
  access_revoked: { icon: Lock, tone: 'bg-red-50 text-red-600', label: 'Access' },
  new_lesson: { icon: BookOpen, tone: 'bg-primary-50 text-primary-600', label: 'Course' },
  course_update: { icon: RefreshCw, tone: 'bg-primary-50 text-primary-600', label: 'Course' },
  progress_milestone: { icon: Trophy, tone: 'bg-amber-50 text-amber-600', label: 'Progress' },
  certificate: { icon: Award, tone: 'bg-amber-50 text-amber-600', label: 'Certificate' },
  task: { icon: ListChecks, tone: 'bg-violet-50 text-violet-600', label: 'Task' },
  event: { icon: CalendarClock, tone: 'bg-sky-50 text-sky-600', label: 'Event' },
  payment: { icon: CreditCard, tone: 'bg-emerald-50 text-emerald-600', label: 'Payment' },
  announcement: { icon: Megaphone, tone: 'bg-ink-100 text-ink-600', label: 'Announcement' },
};

const FALLBACK = { icon: Bell, tone: 'bg-ink-100 text-ink-600', label: 'Update' };

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'course', label: 'Courses' },
  { value: 'certificate', label: 'Certificates' },
  { value: 'other', label: 'Other' },
];

/** Which filter tab a notification belongs under. */
function groupOf(type) {
  if (['new_lesson', 'course_update', 'access_granted', 'access_revoked', 'progress_milestone'].includes(type)) {
    return 'course';
  }
  if (type === 'certificate') return 'certificate';
  return 'other';
}

/** "Today" / "Yesterday" / "12 Oct 2026" — the day heading for a group. */
function dayLabel(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';

  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function timeOf(dateString) {
  return new Date(dateString).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function Notifications() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');

  usePageMeta('Notifications', 'Course updates, certificates, tasks and events.');

  const counts = useMemo(() => {
    const tally = { all: notifications.length, unread: unreadCount, course: 0, certificate: 0, other: 0 };
    for (const notification of notifications) tally[groupOf(notification.type)] += 1;
    return tally;
  }, [notifications, unreadCount]);

  const visible = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter((n) => !n.read);
    return notifications.filter((n) => groupOf(n.type) === filter);
  }, [notifications, filter]);

  /** Newest first, split into day buckets for the headings. */
  const grouped = useMemo(() => {
    const buckets = new Map();
    for (const notification of visible) {
      const key = dayLabel(notification.createdAt);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(notification);
    }
    return [...buckets.entries()];
  }, [visible]);

  const open = (notification) => {
    if (!notification.read) markRead(notification.id);
    // `link` is what the admin or the raising code set; the course page is
    // the fallback for notifications that only carry a courseId.
    if (notification.link) navigate(notification.link);
    else if (notification.courseId) navigate(`/my-courses/${notification.courseId}`);
  };

  const tabs = FILTERS.map((f) => ({ ...f, count: counts[f.value] }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink-900">Notifications</h2>
          <p className="mt-1 text-sm text-ink-500">
            {unreadCount > 0
              ? `${unreadCount} unread ${unreadCount === 1 ? 'update' : 'updates'}`
              : 'You are all caught up.'}
          </p>
        </div>

        {unreadCount > 0 && (
          <Button variant="secondary" size="sm" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            Mark all read
          </Button>
        )}
      </div>

      <Tabs tabs={tabs} value={filter} onChange={setFilter} />

      {visible.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={filter === 'all' ? 'No notifications yet' : 'Nothing in this tab'}
          description={
            filter === 'all'
              ? 'Course updates, certificates, tasks and events from your instructors will appear here.'
              : 'Try another filter to see the rest of your updates.'
          }
          action={<Button to="/dashboard">Back to dashboard</Button>}
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, items]) => (
            <section key={day}>
              <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                {day}
              </h3>

              <ul className="card divide-y divide-ink-100">
                {items.map((notification) => {
                  const { icon: Icon, tone, label } = TYPES[notification.type] || FALLBACK;
                  const navigable = Boolean(notification.link || notification.courseId);

                  return (
                    <li key={notification.id}>
                      <button
                        type="button"
                        onClick={() => open(notification)}
                        className={`flex w-full items-start gap-4 p-4 text-left transition hover:bg-surface-muted ${
                          notification.read ? '' : 'bg-primary-50/40'
                        }`}
                      >
                        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${tone}`}>
                          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {!notification.read && (
                              <span
                                className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary-600"
                                aria-label="Unread"
                              />
                            )}
                            <p className="truncate text-sm font-semibold text-ink-900">
                              {notification.title}
                            </p>
                          </div>
                          <p className="mt-1 text-[13px] leading-relaxed text-ink-600">
                            {notification.message}
                          </p>
                          <p className="mt-1.5 text-[11px] text-ink-400">
                            {label} · {timeOf(notification.createdAt)}
                            {navigable ? ' · Tap to open' : ''}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
