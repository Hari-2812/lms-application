import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import {
  createEvent,
  deleteEvent,
  getAllEvents,
  toErrorMessage,
  updateEvent,
} from '../../api/client';
import Badge from '../common/Badge.jsx';
import Button from '../common/Button.jsx';
import Input from '../common/Input.jsx';
import RichTextEditor from '../common/RichTextEditor.jsx';

/**
 * Admin CRUD for upcoming events — the backend behind the student-facing
 * /events page.
 */

const TYPES = [
  { value: 'webinar', label: 'Webinar' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'program', label: 'Program' },
  { value: 'placement', label: 'Placement drive' },
  { value: 'other', label: 'Other' },
];

const EMPTY = {
  title: '',
  type: 'webinar',
  summary: '',
  descriptionHtml: '',
  startsAt: '',
  endsAt: '',
  location: '',
  joinUrl: '',
  host: '',
  courseId: '',
  published: true,
};

/**
 * <input type="datetime-local"> needs "YYYY-MM-DDTHH:mm" in LOCAL time.
 * toISOString() would shift by the timezone offset, so the offset is
 * subtracted first — otherwise editing an event silently moves it.
 */
function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export default function EventManager({ courses = [], onChanged }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  // On by default: a new event is exactly what learners want to hear about.
  const [notifyStudents, setNotifyStudents] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const load = () =>
    getAllEvents()
      .then(setEvents)
      .catch((err) => setError(toErrorMessage(err)))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const set = (key) => (event) => {
    const target = event.target;
    setForm((prev) => ({
      ...prev,
      [key]: target.type === 'checkbox' ? target.checked : target.value,
    }));
  };

  const reset = () => {
    setForm(EMPTY);
    setEditingId(null);
    setNotifyStudents(true);
    setError('');
  };

  const startEdit = (event) => {
    setEditingId(event._id);
    setOpen(true);
    setForm({
      title: event.title || '',
      type: event.type || 'webinar',
      summary: event.summary || '',
      descriptionHtml: event.descriptionHtml || '',
      startsAt: toLocalInput(event.startsAt),
      endsAt: toLocalInput(event.endsAt),
      location: event.location || '',
      joinUrl: event.joinUrl || '',
      host: event.host || '',
      courseId: event.courseId || '',
      published: event.published !== false,
    });
  };

  const handleSubmit = async (submitEvent) => {
    submitEvent.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = {
        ...form,
        // datetime-local gives a local-time string; new Date() reads it as
        // local and the API stores the correct instant.
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : '',
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : '',
        courseId: form.courseId || null,
        notifyStudents,
      };

      if (editingId) {
        const updated = await updateEvent(editingId, payload);
        setEvents((prev) => prev.map((e) => (e._id === editingId ? updated : e)));
      } else {
        const created = await createEvent(payload);
        setEvents((prev) => [created, ...prev]);
      }

      reset();
      setOpen(false);
      onChanged?.();
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (event) => {
    if (!window.confirm(`Delete "${event.title}"?`)) return;
    try {
      await deleteEvent(event._id);
      setEvents((prev) => prev.filter((e) => e._id !== event._id));
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  const now = Date.now();

  return (
    <section id="events" className="admin-card scroll-mt-20 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink-900">Upcoming events</h2>
            <p className="mt-0.5 text-[12.5px] text-ink-500">
              Webinars, workshops and sessions shown to learners under Upcoming Events.
            </p>
          </div>
        </div>

        <Button
          size="sm"
          variant={open ? 'secondary' : 'primary'}
          onClick={() => {
            if (open) reset();
            setOpen((v) => !v);
          }}
        >
          {open ? (
            <>
              <X className="h-4 w-4" aria-hidden="true" />
              Cancel
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New event
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 border-b border-red-100 bg-red-50 px-6 py-3 text-[13px] text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {open && (
        <form onSubmit={handleSubmit} className="space-y-4 border-b border-ink-100 bg-surface-muted p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Title" required value={form.title} onChange={set('title')} placeholder="e.g. Live SQL doubt-clearing session" />

            <div>
              <label className="field-label" htmlFor="event-type">
                Type
              </label>
              <select id="event-type" className="field-input" value={form.type} onChange={set('type')}>
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Starts at"
              type="datetime-local"
              required
              value={form.startsAt}
              onChange={set('startsAt')}
            />
            <Input
              label="Ends at (optional)"
              type="datetime-local"
              value={form.endsAt}
              onChange={set('endsAt')}
            />

            <Input label="Location" value={form.location} onChange={set('location')} placeholder="Online / Zoom / Campus" />
            <Input label="Host (optional)" value={form.host} onChange={set('host')} placeholder="e.g. Vasanth Kumar" />

            <Input
              label="Joining link"
              value={form.joinUrl}
              onChange={set('joinUrl')}
              placeholder="https://meet.google.com/…"
              hint="Revealed to students 24 hours before the start time."
            />

            <div>
              <label className="field-label" htmlFor="event-course">
                Course (optional)
              </label>
              <select id="event-course" className="field-input" value={form.courseId} onChange={set('courseId')}>
                <option value="">All students</option>
                {courses.map((course) => (
                  <option key={course._id} value={course._id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="event-summary">
              Short summary
            </label>
            <textarea
              id="event-summary"
              className="field-input min-h-[60px] resize-y"
              value={form.summary}
              onChange={set('summary')}
              maxLength={240}
              placeholder="One line shown on the event card."
            />
          </div>

          <RichTextEditor
            label="Details (formatted)"
            value={form.descriptionHtml}
            onChange={(html) => setForm((prev) => ({ ...prev, descriptionHtml: html }))}
            placeholder="Agenda, what to prepare, who it is for…"
            minHeight="9rem"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-5">
              <label className="flex items-center gap-2.5 text-[13px] text-ink-700">
                <input
                  type="checkbox"
                  checked={form.published}
                  onChange={set('published')}
                  className="h-4 w-4 rounded border-ink-300 text-primary-600 focus:ring-primary-500/30"
                />
                Published
              </label>

              {!editingId && (
                <label className="flex items-center gap-2.5 text-[13px] text-ink-700">
                  <input
                    type="checkbox"
                    checked={notifyStudents}
                    onChange={(e) => setNotifyStudents(e.target.checked)}
                    className="h-4 w-4 rounded border-ink-300 text-primary-600 focus:ring-primary-500/30"
                  />
                  Notify learners
                </label>
              )}
            </div>

            <Button type="submit" size="sm" loading={saving} disabled={saving}>
              <Save className="h-4 w-4" aria-hidden="true" />
              {editingId ? 'Save changes' : 'Create event'}
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center gap-2 p-6 text-sm text-ink-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading events...
        </div>
      ) : events.length === 0 ? (
        <p className="p-6 text-sm text-ink-500">
          No events yet. Create one and it appears under Upcoming Events for students.
        </p>
      ) : (
        <div className="divide-y divide-ink-100">
          {events.map((event) => {
            const starts = new Date(event.startsAt);
            const isPast = starts.getTime() < now;

            return (
              <div
                key={event._id}
                className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-ink-900">{event.title}</p>
                    {event.published === false && <Badge tone="neutral">Draft</Badge>}
                    {isPast && <Badge tone="neutral">Past</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {TYPES.find((t) => t.value === event.type)?.label || 'Event'} ·{' '}
                    {starts.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                    {event.location ? ` · ${event.location}` : ''}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(event)}
                    aria-label={`Edit ${event.title}`}
                    className="rounded-lg p-2 text-ink-400 transition hover:bg-primary-50 hover:text-primary-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(event)}
                    aria-label={`Delete ${event.title}`}
                    className="rounded-lg p-2 text-ink-400 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
