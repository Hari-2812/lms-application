import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, Send } from 'lucide-react';
import {
  broadcastNotification,
  getCourses,
  getEnrollments,
  getStudents,
  toErrorMessage,
} from '../../api/client';
import Button from '../common/Button.jsx';
import Input from '../common/Input.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

/**
 * Admin composer for student notifications — what the admin sees on
 * /notifications above their own inbox.
 *
 * The type decides who a notification reaches when no single student is
 * picked (the server's resolveAudience mirrors the rules described here):
 *   Pending dues     — students with a pending payment, optionally for one course
 *   New course added — every student who does not have that course yet
 *   Access granted   — one student; sending it also grants the access
 *   everything else  — students with access to the course, or all students
 */

const TYPES = [
  { value: 'announcement', label: 'Announcement' },
  { value: 'payment', label: 'Pending dues' },
  { value: 'new_course', label: 'New course added' },
  { value: 'access_granted', label: 'Access granted' },
  { value: 'course_update', label: 'Course update' },
  { value: 'task', label: 'Task / assignment' },
  { value: 'event', label: 'Upcoming event' },
  { value: 'certificate', label: 'Certificate update' },
];

const EMPTY = { type: 'announcement', title: '', message: '', courseId: '', studentId: '', link: '' };

/** Populated refs serialise as `id` (users) or `_id` (courses). */
const idOf = (ref) => String(ref?.id ?? ref?._id ?? ref ?? '');

const rupees = (amount) => `₹${Number(amount).toLocaleString('en-IN')}`;

/** The suggested message for a type, or '' when there is nothing to suggest. */
function templateFor({ type, courseId, studentId }, courses, pending) {
  const course = courses.find((c) => c._id === courseId);
  const name = course ? `"${course.title}"` : '';

  if (type === 'payment') {
    // The amount the student checked out at, else the course's current price.
    const owed = pending.find((e) => idOf(e.studentId) === studentId && idOf(e.courseId) === courseId);
    const amount = owed?.amount || course?.price;
    if (!course) return 'You have a course payment pending. Complete it to unlock your course.';
    return `Your payment${amount > 0 ? ` of ${rupees(amount)}` : ''} for ${name} is still pending. Complete it to unlock the course.`;
  }
  if (type === 'new_course' && course) return `${name} is now available. Take a look and enrol.`;
  if (type === 'access_granted' && course) return `You now have access to ${name}. Start learning any time.`;
  return '';
}

export default function NotificationComposer() {
  // Granting access is a Super Admin action; Support / Reviewer never sees the type.
  const { isSuperAdmin } = useAuth();
  const types = TYPES.filter((t) => isSuperAdmin || t.value !== 'access_granted');
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [pending, setPending] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadStudents = () => getStudents().then(setStudents);

  useEffect(() => {
    Promise.all([getCourses().then(setCourses), loadStudents(), getEnrollments('pending').then(setPending)]).catch(
      (err) => setError(toErrorMessage(err))
    );
  }, []);

  const { type, courseId, studentId } = form;
  const isPayment = type === 'payment';
  const courseRequired = type === 'new_course' || type === 'access_granted';
  const studentRequired = type === 'access_granted';

  /** Pending dues only lists courses and students that actually owe something. */
  const courseOptions = useMemo(() => {
    if (!isPayment) {
      // Students cannot open a draft, so it is worth seeing before announcing one.
      return courses.map((c) => ({ value: c._id, label: c.published === false ? `${c.title} (draft)` : c.title }));
    }

    const owing = new Map();
    for (const e of pending) owing.set(idOf(e.courseId), (owing.get(idOf(e.courseId)) || 0) + 1);
    return courses
      .filter((c) => owing.has(c._id))
      .map((c) => ({ value: c._id, label: `${c.title} — ${owing.get(c._id)} pending` }));
  }, [isPayment, courses, pending]);

  const studentOptions = useMemo(() => {
    if (isPayment) {
      const owing = new Set(
        pending.filter((e) => !courseId || idOf(e.courseId) === courseId).map((e) => idOf(e.studentId))
      );
      return students.filter((s) => owing.has(s.id));
    }
    return students;
  }, [isPayment, students, pending, courseId]);

  /**
   * Applies a change and keeps the suggested message in step with it — but
   * only while the admin has not written their own.
   */
  const update = (changes) => {
    setForm((prev) => {
      const next = { ...prev, ...changes };

      if (changes.type && changes.type !== prev.type) {
        next.courseId = '';
        next.studentId = '';
      }

      const before = templateFor(prev, courses, pending);
      if (!('message' in changes) && (!prev.message || prev.message === before)) {
        next.message = templateFor(next, courses, pending);
      }
      return next;
    });
  };

  const onCourseChange = (value) => {
    // For the plain types the single student overrides the course, so picking
    // a course clears it. Pending dues clears it only if they owe nothing there.
    let clearStudent = !courseRequired;
    if (isPayment && studentId) {
      clearStudent = !pending.some((e) => idOf(e.studentId) === studentId && (!value || idOf(e.courseId) === value));
    }
    update({ courseId: value, ...(clearStudent ? { studentId: '' } : {}) });
  };

  const courseTitle = courses.find((c) => c._id === courseId)?.title;
  const student = students.find((s) => s.id === studentId);

  const audience = (() => {
    if (type === 'access_granted') {
      return student && courseTitle
        ? `Grants ${student.name} access to "${courseTitle}" and lets them know.`
        : 'Pick a student and a course. Sending grants the access as well.';
    }
    if (student) return `Goes to ${student.name} only.`;
    if (isPayment) {
      const owing = studentOptions.length;
      return `Goes to ${owing} ${owing === 1 ? 'student' : 'students'} with a pending payment${
        courseTitle ? ` for "${courseTitle}"` : ''
      }.`;
    }
    if (type === 'new_course') {
      return courseTitle
        ? `Goes to every student who doesn't have "${courseTitle}" yet.`
        : 'Pick the course that was added.';
    }
    if (courseTitle) return `Goes to every student with access to "${courseTitle}".`;
    return `Goes to all ${students.length} ${students.length === 1 ? 'student' : 'students'}.`;
  })();

  const linkPlaceholder =
    isPayment ? '/my-courses' : courseRequired ? 'The course page' : '/certificates';

  const onSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError('');
    setSuccess('');
    try {
      const result = await broadcastNotification({
        type,
        title: form.title || undefined,
        message: form.message,
        courseId: courseId || undefined,
        studentId: studentId || undefined,
        link: form.link || undefined,
      });
      setSuccess(
        type === 'access_granted'
          ? `Access granted to ${student?.name || 'the student'} and notification sent`
          : `Notification sent to ${result.targeted} ${result.targeted === 1 ? 'student' : 'students'}`
      );
      setForm(EMPTY);
      // A grant changes the student's access count, which the dropdown shows.
      if (type === 'access_granted') loadStudents().catch(() => {});
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="admin-card overflow-hidden">
      <div className="border-b border-ink-100 px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-[15px] font-semibold text-ink-900">Send a notification</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-500">
            Goes straight to the bell icon in the learner dashboard, in real time.
          </p>
        </div>
      </div>
      <div className="p-5 sm:p-6">

      {error && (
        <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <p>{success}</p>
        </div>
      )}

      <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="notification-type">
            Type
          </label>
          <select
            id="notification-type"
            className="field-input"
            value={type}
            onChange={(e) => update({ type: e.target.value })}
          >
            {types.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <Input
          label="Title"
          value={form.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="Leave empty to use the type's default"
        />

        <div>
          <label className="field-label" htmlFor="notification-course">
            {type === 'new_course' ? 'New course' : courseRequired ? 'Course' : 'Course (optional)'}
          </label>
          <select
            id="notification-course"
            className="field-input"
            required={courseRequired}
            value={courseId}
            onChange={(e) => onCourseChange(e.target.value)}
          >
            <option value="">
              {courseRequired ? 'Choose a course…' : isPayment ? 'Any course with a pending payment' : 'All students'}
            </option>
            {courseOptions.map((c) => (
              <option key={c.value} value={c.value}>
                {isPayment || courseRequired ? c.label : `Students with access to ${c.label}`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="notification-student">
            {studentRequired ? 'Student' : 'Single student (optional)'}
          </label>
          <select
            id="notification-student"
            className="field-input"
            required={studentRequired}
            value={studentId}
            onChange={(e) => update({ studentId: e.target.value })}
          >
            <option value="">{studentRequired ? 'Choose a student…' : '—'}</option>
            {studentOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.email}){studentRequired && s.accessCount === 0 ? ' — new, no courses yet' : ''}
              </option>
            ))}
          </select>
          {!studentRequired && (
            <p className="mt-1.5 text-xs text-ink-500">
              {isPayment && studentOptions.length === 0
                ? 'No students have a pending payment right now.'
                : 'Overrides the course selection.'}
            </p>
          )}
        </div>

        <div className="lg:col-span-2">
          <label className="field-label" htmlFor="notification-message">
            Message
          </label>
          <textarea
            id="notification-message"
            required
            className="field-input min-h-[90px] resize-y"
            value={form.message}
            onChange={(e) => update({ message: e.target.value })}
            placeholder="What do you want students to know?"
          />
        </div>

        <Input
          label="Link (optional)"
          value={form.link}
          onChange={(e) => update({ link: e.target.value })}
          placeholder={linkPlaceholder}
          hint={
            isPayment || courseRequired
              ? `An in-app path. Leave empty to send students to ${isPayment ? 'My Courses' : 'the course page'}.`
              : 'An in-app path. Clicking the notification takes the student here.'
          }
          className="lg:col-span-2"
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:col-span-2">
          <Button type="submit" loading={sending} disabled={sending}>
            <Send className="h-4 w-4" aria-hidden="true" />
            {type === 'access_granted' ? 'Grant access & notify' : 'Send notification'}
          </Button>
          <p className="flex items-center gap-1.5 text-xs text-ink-500">
            <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {audience}
          </p>
        </div>
      </form>
      </div>
    </section>
  );
}
