import { useEffect, useState } from 'react';
import { CalendarClock, ClipboardList, Pencil, Plus, Send, Trash2, X } from 'lucide-react';
import {
  createAssignment,
  deleteAssignment,
  getAdminAssignments,
  toErrorMessage,
  updateAssignment,
} from '../../api/client';
import Button from '../common/Button.jsx';
import Input from '../common/Input.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { EmptyRow, LoadingRow, Panel, Pill, formatDate, useFlash } from './ui.jsx';

/**
 * Admin CRUD for assignments — tasks with a due date. Publishing one tells
 * the learners it is for (that course's learners, or everyone).
 */

const EMPTY = { title: '', description: '', courseId: '', dueDate: '', maxScore: 100, published: true };

/** datetime-local wants local "YYYY-MM-DDTHH:mm"; toISOString would shift by the offset. */
function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function AssignmentManager({ courses = [], onChanged }) {
  const { isSuperAdmin } = useAuth();
  const flash = useFlash();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () =>
    getAdminAssignments()
      .then(setAssignments)
      .catch((err) => flash.error(toErrorMessage(err)))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  const set = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));

  const startEdit = (assignment) => {
    setEditingId(assignment.id);
    setForm({
      title: assignment.title,
      description: assignment.description || '',
      courseId: assignment.courseId?._id || '',
      dueDate: toLocalInput(assignment.dueDate),
      maxScore: assignment.maxScore || 100,
      published: assignment.published,
    });
    setOpen(true);
  };

  const reset = () => {
    setForm(EMPTY);
    setEditingId(null);
    setOpen(false);
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : '',
      courseId: form.courseId || '',
    };
    try {
      const saved = editingId ? await updateAssignment(editingId, payload) : await createAssignment(payload);
      flash.success(
        saved.notified
          ? `"${saved.title}" saved and ${saved.notified} learner${saved.notified === 1 ? '' : 's'} notified.`
          : `"${saved.title}" saved${saved.published ? '' : ' as a draft'}.`
      );
      reset();
      await load();
      onChanged?.();
    } catch (err) {
      flash.error(toErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const publish = async (assignment) => {
    try {
      const saved = await updateAssignment(assignment.id, { published: true });
      flash.success(`Published — ${saved.notified} learner${saved.notified === 1 ? '' : 's'} notified.`);
      load();
    } catch (err) {
      flash.error(toErrorMessage(err));
    }
  };

  const remove = async (assignment) => {
    if (!window.confirm(`Delete "${assignment.title}"? Submissions already made are kept.`)) return;
    try {
      await deleteAssignment(assignment.id);
      setAssignments((prev) => prev.filter((a) => a.id !== assignment.id));
      flash.success('Task deleted.');
    } catch (err) {
      flash.error(toErrorMessage(err));
    }
  };

  return (
    <Panel
      icon={CalendarClock}
      title="Tasks & assignments"
      description="Set work with a due date. Learners are notified the moment it is published."
      actions={
        isSuperAdmin &&
        !open && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New task
          </Button>
        )
      }
      bodyClassName=""
    >
      {flash.node && <div className="px-5 pt-4 sm:px-6">{flash.node}</div>}

      {open && (
        <form onSubmit={onSubmit} className="grid gap-4 border-b border-ink-100 bg-ink-50/50 px-5 py-5 sm:px-6 lg:grid-cols-2">
          <Input label="Task title" required value={form.title} onChange={set('title')} maxLength={160} placeholder="e.g. Week 3 — Build a sales dashboard" />
          <div>
            <label className="field-label" htmlFor="assignment-course">For learners in</label>
            <select id="assignment-course" className="field-input" value={form.courseId} onChange={set('courseId')}>
              <option value="">All learners</option>
              {courses.map((c) => (
                <option key={c._id} value={c._id}>{c.title}</option>
              ))}
            </select>
          </div>
          <Input label="Due date" type="datetime-local" value={form.dueDate} onChange={set('dueDate')} hint="Shown to learners and in their notification." />
          <Input label="Maximum score" type="number" min={1} max={1000} value={form.maxScore} onChange={set('maxScore')} />
          <div className="lg:col-span-2">
            <label className="field-label" htmlFor="assignment-description">Instructions</label>
            <textarea
              id="assignment-description"
              className="field-input min-h-[90px] resize-y"
              value={form.description}
              onChange={set('description')}
              maxLength={4000}
              placeholder="What to build, what to submit, how it will be marked…"
            />
          </div>
          <label className="flex items-center gap-2 text-[13px] text-ink-700 lg:col-span-2">
            <input type="checkbox" className="h-4 w-4 rounded border-primary-200 text-primary-600" checked={form.published} onChange={set('published')} />
            Publish now and notify learners
          </label>
          <div className="flex gap-2 lg:col-span-2">
            <Button type="submit" size="sm" loading={saving}>
              <Send className="h-4 w-4" aria-hidden="true" />
              {editingId ? 'Save task' : form.published ? 'Publish task' : 'Save draft'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={reset}>
              <X className="h-4 w-4" aria-hidden="true" />
              Cancel
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <LoadingRow label="Loading tasks…" />
      ) : assignments.length === 0 ? (
        <EmptyRow icon={ClipboardList} title="No tasks yet" description="Create one to give learners work with a due date." />
      ) : (
        <div className="overflow-x-auto">
          <table className="admin-table min-w-[48rem]">
            <thead>
              <tr>
                <th>Task</th>
                <th>For</th>
                <th>Due</th>
                <th>Submissions</th>
                <th>Status</th>
                {isSuperAdmin && <th className="text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => {
                const overdue = a.dueDate && new Date(a.dueDate) < new Date();
                return (
                  <tr key={a.id}>
                    <td>
                      <p className="font-medium text-ink-900">{a.title}</p>
                      <p className="text-[11.5px] text-ink-400">Max score {a.maxScore}</p>
                    </td>
                    <td className="text-[13px]">{a.courseId?.title || 'All learners'}</td>
                    <td className="whitespace-nowrap text-[13px]">
                      {a.dueDate ? (
                        <span className={overdue ? 'font-semibold text-red-600' : ''}>{formatDate(a.dueDate, true)}</span>
                      ) : (
                        'No due date'
                      )}
                    </td>
                    <td className="tabular-nums">
                      {a.submissionCount}
                      {a.awaitingReview > 0 && <Pill tone="amber" className="ml-2">{a.awaitingReview} to review</Pill>}
                    </td>
                    <td>{a.published ? <Pill tone="green">Published</Pill> : <Pill tone="gray">Draft</Pill>}</td>
                    {isSuperAdmin && (
                      <td>
                        <div className="flex justify-end gap-1">
                          {!a.published && (
                            <Button size="sm" variant="soft" onClick={() => publish(a)}>
                              Publish
                            </Button>
                          )}
                          <button type="button" onClick={() => startEdit(a)} aria-label={`Edit ${a.title}`} className="rounded-lg p-2 text-primary-600 transition hover:bg-primary-50">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => remove(a)} aria-label={`Delete ${a.title}`} className="rounded-lg p-2 text-red-600 transition hover:bg-red-50">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
