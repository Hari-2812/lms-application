import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Pencil, Search, Star, Trash2, X } from 'lucide-react';
import { deleteReview, getAdminReviews, getCourses, moderateReview, toErrorMessage } from '../../api/client';
import { usePageMeta } from '../../components/layout/DashboardLayout.jsx';
import Button from '../../components/common/Button.jsx';
import {
  Alert,
  EmptyRow,
  FilterBar,
  FilterField,
  LoadingRow,
  PageHeader,
  Panel,
  Pill,
  StatTile,
  formatDate,
  useFlash,
} from '../../components/admin/ui.jsx';

/**
 * Admin → Reviews: every course review learners have left.
 *
 * Reviews go live as soon as a learner posts them (under the lesson video
 * and on the course page). From here staff can hide one (the learner still
 * sees it, marked hidden), correct its rating or wording (shown as "edited
 * by the admin team"), or delete it outright.
 */

function Stars({ value }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} aria-hidden="true" className={`h-3.5 w-3.5 ${i <= value ? 'fill-amber-400 text-amber-400' : 'fill-ink-200 text-ink-200'}`} />
      ))}
    </span>
  );
}

export default function AdminReviews() {
  const flash = useFlash();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState(params.get('search') || '');
  const [editing, setEditing] = useState(null); // { id, rating, comment }
  const [busy, setBusy] = useState('');

  usePageMeta('Reviews', 'Course reviews from learners.');

  const filters = {
    search: params.get('search') || '',
    courseId: params.get('courseId') || '',
    rating: params.get('rating') || '',
    status: params.get('status') || '',
  };

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const load = () =>
    getAdminReviews(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)))
      .then((result) => {
        setData(result);
        setError('');
      })
      .catch((err) => setError(toErrorMessage(err)));

  useEffect(() => {
    getCourses().then(setCourses).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the URL params are the dependency
  }, [params]);

  useEffect(() => {
    const id = setTimeout(() => {
      if (query.trim() !== filters.search) setFilter('search', query.trim());
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed text drives this
  }, [query]);

  const act = async (key, action, message) => {
    setBusy(key);
    try {
      await action();
      await load();
      flash.success(message);
      return true;
    } catch (err) {
      flash.error(toErrorMessage(err));
      return false;
    } finally {
      setBusy('');
    }
  };

  const toggleHidden = (review) =>
    act(
      `hide-${review._id}`,
      () => moderateReview(review._id, { hidden: !review.hidden }),
      review.hidden ? 'Review is visible again.' : 'Review hidden from the course page.'
    );

  const remove = (review) => {
    if (!window.confirm(`Delete ${review.studentId?.name || 'this learner'}'s review? This cannot be undone.`)) return;
    act(`delete-${review._id}`, () => deleteReview(review._id), 'Review deleted.');
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    const ok = await act(
      `edit-${editing.id}`,
      () => moderateReview(editing.id, { rating: editing.rating, comment: editing.comment }),
      'Review updated. It is marked "edited by the admin team".'
    );
    if (ok) setEditing(null);
  };

  const summary = data?.summary;
  const reviews = data?.reviews || [];
  const filtered = Object.values(filters).some(Boolean);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Star}
        title="Course reviews"
        description="Learners who can open a course rate it from 1 to 5 stars and can add a comment. Reviews appear straight away under the lesson video and on the course page; hide, correct or delete them here."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={filtered ? 'Matching reviews' : 'Reviews'} value={summary?.total ?? '—'} />
        <StatTile label="Average rating (visible)" value={summary ? (summary.average ? summary.average.toFixed(1) : '—') : '—'} />
        <StatTile label="1–2 star reviews" value={summary?.lowRatings ?? '—'} tone={summary?.lowRatings ? 'amber' : undefined} />
        <StatTile label="Hidden" value={summary?.hidden ?? '—'} />
      </section>

      {flash.node}
      <Alert tone="error">{error}</Alert>

      <Panel title="All reviews" bodyClassName="">
        <FilterBar>
          <FilterField label="Search" className="lg:flex-1">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-400" aria-hidden="true" />
              <input
                type="search"
                className="admin-field w-full pl-9"
                placeholder="Learner name, email or review text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </FilterField>
          <FilterField label="Course" className="lg:w-56">
            <select className="admin-field" value={filters.courseId} onChange={(e) => setFilter('courseId', e.target.value)}>
              <option value="">All courses</option>
              {courses.map((c) => (
                <option key={c._id} value={c._id}>{c.title}</option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Rating" className="lg:w-36">
            <select className="admin-field" value={filters.rating} onChange={(e) => setFilter('rating', e.target.value)}>
              <option value="">Any</option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>{n} star{n === 1 ? '' : 's'}</option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Visibility" className="lg:w-36">
            <select className="admin-field" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
              <option value="">All</option>
              <option value="visible">Visible</option>
              <option value="hidden">Hidden</option>
            </select>
          </FilterField>
        </FilterBar>

        {!data ? (
          <LoadingRow label="Loading reviews…" />
        ) : reviews.length === 0 ? (
          <EmptyRow
            icon={Star}
            title={filtered ? 'No reviews match these filters' : 'No reviews yet'}
            description={filtered ? 'Try clearing a filter.' : 'Reviews appear here as soon as learners post them.'}
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {reviews.map((review) => {
              const isEditing = editing?.id === review._id;
              return (
                <li key={review._id} className={`px-5 py-4 sm:px-6 ${review.hidden ? 'bg-ink-50/60' : ''}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Stars value={review.rating} />
                        <p className="text-sm font-semibold text-ink-900">{review.studentId?.name || 'Deleted account'}</p>
                        <span className="text-[12px] text-ink-500">{review.studentId?.email}</span>
                        {review.hidden && <Pill tone="gray">Hidden</Pill>}
                        {review.editedByAdmin && <Pill tone="blue">Edited by admin</Pill>}
                      </div>
                      <p className="mt-0.5 text-[12.5px] text-ink-500">
                        {review.courseId?.title || 'Deleted course'} · {formatDate(review.createdAt, true)}
                        {review.updatedAt !== review.createdAt ? ` · updated ${formatDate(review.updatedAt)}` : ''}
                      </p>
                    </div>
                    {!isEditing && (
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => setEditing({ id: review._id, rating: review.rating, comment: review.comment })}>
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
                        </Button>
                        <Button size="sm" variant="secondary" loading={busy === `hide-${review._id}`} onClick={() => toggleHidden(review)}>
                          {review.hidden ? <Eye className="h-3.5 w-3.5" aria-hidden="true" /> : <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />}
                          {review.hidden ? 'Unhide' : 'Hide'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          loading={busy === `delete-${review._id}`}
                          onClick={() => remove(review)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete
                        </Button>
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    <form onSubmit={saveEdit} className="mt-3 space-y-3 rounded-xl border border-ink-200 bg-white p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <label htmlFor={`rating-${review._id}`} className="text-[13px] font-semibold text-ink-800">Rating</label>
                        <select
                          id={`rating-${review._id}`}
                          className="admin-field w-28"
                          value={editing.rating}
                          onChange={(e) => setEditing({ ...editing, rating: Number(e.target.value) })}
                        >
                          {[5, 4, 3, 2, 1].map((n) => (
                            <option key={n} value={n}>{n} star{n === 1 ? '' : 's'}</option>
                          ))}
                        </select>
                      </div>
                      <textarea
                        aria-label="Review text"
                        className="field-input min-h-[80px] resize-y"
                        maxLength={1000}
                        value={editing.comment}
                        onChange={(e) => setEditing({ ...editing, comment: e.target.value })}
                      />
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" loading={busy === `edit-${review._id}`}>Save</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                          <X className="h-3.5 w-3.5" aria-hidden="true" /> Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    review.comment && <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-700">{review.comment}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
