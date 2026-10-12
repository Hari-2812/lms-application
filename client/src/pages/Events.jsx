import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  CalendarDays,
  ExternalLink,
  MapPin,
  Presentation,
  User as UserIcon,
  Video,
} from 'lucide-react';
import { getEvents, toErrorMessage } from '../api/client';
import { usePageMeta } from '../components/layout/DashboardLayout.jsx';
import Badge from '../components/common/Badge.jsx';
import Button from '../components/common/Button.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import RichText from '../components/common/RichText.jsx';
import Skeleton from '../components/common/Skeleton.jsx';
import Tabs from '../components/common/Tabs.jsx';
import { ErrorState } from '../components/States.jsx';
import { hasRichText } from '../utils/sanitize.js';

/**
 * Upcoming programmes, webinars and other scheduled activities, as entered
 * by an admin in the dashboard.
 *
 * The joining link is withheld by the API until the event is within a day of
 * starting, so this shows a "link opens on …" note until then rather than
 * pretending there is nothing there.
 */

const TYPES = {
  webinar: { label: 'Webinar', icon: Video, tone: 'primary' },
  workshop: { label: 'Workshop', icon: Presentation, tone: 'success' },
  program: { label: 'Program', icon: CalendarDays, tone: 'warning' },
  placement: { label: 'Placement', icon: UserIcon, tone: 'neutral' },
  other: { label: 'Event', icon: CalendarClock, tone: 'neutral' },
};

const SCOPES = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
];

const dateFormat = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
const timeFormat = { hour: '2-digit', minute: '2-digit' };

/** "in 3 days" / "tomorrow" / "today" — how soon this is. */
function countdown(startsAt) {
  const ms = new Date(startsAt).getTime() - Date.now();
  if (ms < 0) return null;

  const days = Math.floor(ms / 86400000);
  if (days === 0) {
    const hours = Math.floor(ms / 3600000);
    return hours <= 1 ? 'starting soon' : `in ${hours} hours`;
  }
  if (days === 1) return 'tomorrow';
  if (days < 14) return `in ${days} days`;
  return null;
}

function EventCard({ event }) {
  const { label, icon: Icon, tone } = TYPES[event.type] || TYPES.other;
  const starts = new Date(event.startsAt);
  const soon = countdown(event.startsAt);

  const timeRange = event.endsAt
    ? `${starts.toLocaleTimeString('en-GB', timeFormat)} – ${new Date(event.endsAt).toLocaleTimeString('en-GB', timeFormat)}`
    : starts.toLocaleTimeString('en-GB', timeFormat);

  return (
    <article className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
      {/* Date block, so a list of events scans by date down the left edge. */}
      <div className="flex shrink-0 flex-row items-center gap-3 sm:w-20 sm:flex-col sm:gap-0 sm:text-center">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-primary-600">
          {starts.toLocaleDateString('en-GB', { month: 'short' })}
        </span>
        <span className="text-2xl font-bold leading-none tabular-nums text-ink-900">
          {starts.getDate()}
        </span>
        <span className="text-[11px] text-ink-500 sm:mt-0.5">
          {starts.toLocaleDateString('en-GB', { weekday: 'short' })}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={tone} icon={Icon}>
            {label}
          </Badge>
          {soon && <Badge tone="warning">{soon}</Badge>}
        </div>

        <h3 className="mt-2.5 text-base font-semibold leading-snug text-ink-900">{event.title}</h3>

        {event.summary && (
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">{event.summary}</p>
        )}

        {hasRichText(event.descriptionHtml) && (
          <RichText html={event.descriptionHtml} className="mt-3" />
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-500">
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
            {starts.toLocaleDateString('en-GB', dateFormat)} · {timeRange}
          </span>
          {event.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              {event.location}
            </span>
          )}
          {event.host && (
            <span className="inline-flex items-center gap-1.5">
              <UserIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {event.host}
            </span>
          )}
        </div>
      </div>

      <div className="shrink-0 sm:self-center">
        {event.joinUrl ? (
          <Button href={event.joinUrl} target="_blank" rel="noopener noreferrer" size="sm">
            Join
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        ) : event.joinUrlAvailableAt ? (
          <p className="max-w-[9rem] text-[11px] leading-relaxed text-ink-500">
            Joining link appears{' '}
            {new Date(event.joinUrlAvailableAt).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
            })}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export default function Events() {
  const [scope, setScope] = useState('upcoming');
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  usePageMeta('Upcoming Events', 'Webinars, workshops and scheduled programmes.');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    getEvents(scope)
      .then((data) => {
        if (cancelled) return;
        setEvents(data);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(toErrorMessage(err));
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [scope]);

  /** Grouped under a month heading so a long list stays readable. */
  const grouped = useMemo(() => {
    const buckets = new Map();
    for (const event of events) {
      const key = new Date(event.startsAt).toLocaleDateString('en-GB', {
        month: 'long',
        year: 'numeric',
      });
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(event);
    }
    return [...buckets.entries()];
  }, [events]);

  if (status === 'error') return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink-900">Upcoming Events</h2>
        <p className="mt-1 text-sm text-ink-500">
          Webinars, workshops, placement drives and scheduled programmes.
        </p>
      </div>

      <Tabs tabs={SCOPES} value={scope} onChange={setScope} />

      {status === 'loading' ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-36 rounded-card" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={scope === 'upcoming' ? 'Nothing scheduled yet' : 'No past events'}
          description={
            scope === 'upcoming'
              ? 'When your instructors schedule a webinar, workshop or programme, it will show up here.'
              : 'Events that have already taken place will be listed here.'
          }
          action={<Button to="/dashboard">Back to dashboard</Button>}
        />
      ) : (
        <div className="space-y-8">
          {grouped.map(([month, items]) => (
            <section key={month}>
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                {month}
              </h3>
              <div className="space-y-4">
                {items.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
