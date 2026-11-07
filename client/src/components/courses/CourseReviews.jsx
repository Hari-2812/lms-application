import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, EyeOff, Pencil, Star, Trash2 } from 'lucide-react';
import { deleteMyCourseReview, getCourseReviews, saveCourseReview, toErrorMessage } from '../../api/client';
import Avatar from '../common/Avatar.jsx';
import Button from '../common/Button.jsx';
import Skeleton from '../common/Skeleton.jsx';

/**
 * Course reviews: the rating summary, the learner's own review form, and
 * everyone's reviews, newest first.
 *
 * Any learner who can open the course can leave one review and edit or
 * delete it later. Reviews appear straight away; staff can hide, correct or
 * delete them from Admin → Reviews. Used under the lesson video and on the
 * course details page.
 */

const MAX = 1000;
const LABELS = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very good', 5: 'Excellent' };

function Stars({ value, size = 'h-4 w-4' }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} aria-hidden="true" className={`${size} ${i <= value ? 'fill-amber-400 text-amber-400' : 'fill-ink-200 text-ink-200'}`} />
      ))}
    </span>
  );
}

function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center gap-3">
      <div role="radiogroup" aria-label="Your rating" className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={`${i} star${i === 1 ? '' : 's'} — ${LABELS[i]}`}
            onClick={() => onChange(i)}
            onMouseEnter={() => setHover(i)}
            className="rounded p-0.5 transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <Star className={`h-7 w-7 ${i <= shown ? 'fill-amber-400 text-amber-400' : 'fill-ink-100 text-ink-300'}`} />
          </button>
        ))}
      </div>
      <span className="text-sm font-medium text-ink-600">{shown ? LABELS[shown] : 'Tap a star to rate'}</span>
    </div>
  );
}

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default function CourseReviews({ courseId, className = '', onChange }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ rating: 0, comment: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(
    () =>
      getCourseReviews(courseId)
        .then((result) => {
          setData(result);
          setError('');
        })
        .catch((err) => setError(toErrorMessage(err))),
    [courseId]
  );

  useEffect(() => {
    setData(null);
    setEditing(false);
    load();
  }, [load]);

  const startEditing = () => {
    setForm({ rating: data?.mine?.rating || 0, comment: data?.mine?.comment || '' });
    setFormError('');
    setEditing(true);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.rating) {
      setFormError('Choose a star rating first.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await saveCourseReview(courseId, form);
      setEditing(false);
      await load();
      onChange?.();
    } catch (err) {
      setFormError(toErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete your review?')) return;
    try {
      await deleteMyCourseReview(courseId);
      await load();
      onChange?.();
    } catch (err) {
      setFormError(toErrorMessage(err));
    }
  };

  if (error) {
    return (
      <section className={`card p-6 ${className}`}>
        <p className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" aria-hidden="true" /> {error}
        </p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className={`card space-y-3 p-6 ${className}`}>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-16" />
      </section>
    );
  }

  const { summary, reviews, mine, canReview } = data;
  const others = reviews.filter((r) => !r.mine);

  return (
    <section className={`card p-6 ${className}`} aria-labelledby="reviews-heading">
      <h2 id="reviews-heading" className="text-base font-semibold text-ink-900">
        Learner reviews
      </h2>

      {/* --- summary --- */}
      {summary.count > 0 ? (
        <div className="mt-4 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="text-center sm:pr-6">
            <p className="text-4xl font-bold text-ink-900">{summary.average.toFixed(1)}</p>
            <div className="mt-1 flex justify-center"><Stars value={Math.round(summary.average)} /></div>
            <p className="mt-1 text-[12px] text-ink-500">
              {summary.count} review{summary.count === 1 ? '' : 's'}
            </p>
          </div>
          <ul className="space-y-1.5" aria-label="Rating breakdown">
            {[5, 4, 3, 2, 1].map((stars) => {
              const n = summary.distribution[stars] || 0;
              const pct = summary.count ? Math.round((n / summary.count) * 100) : 0;
              return (
                <li key={stars} className="flex items-center gap-2 text-[12px] text-ink-600">
                  <span className="w-3 tabular-nums">{stars}</span>
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
                    <span className="block h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="w-8 text-right tabular-nums">{n}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="mt-2 text-sm text-ink-600">No reviews yet{canReview ? ' — be the first to share how you found this course.' : '.'}</p>
      )}

      {/* --- the learner's own review --- */}
      {canReview && (
        <div className="mt-6 rounded-xl border border-ink-100 bg-surface-muted p-4 sm:p-5">
          {editing || !mine ? (
            <form onSubmit={submit} className="space-y-3">
              <p className="text-sm font-semibold text-ink-900">{mine ? 'Edit your review' : 'Rate this course'}</p>
              <StarPicker value={form.rating} onChange={(rating) => setForm((f) => ({ ...f, rating }))} />
              <div>
                <label htmlFor={`review-${courseId}`} className="sr-only">Your review</label>
                <textarea
                  id={`review-${courseId}`}
                  className="field-input min-h-[90px] resize-y"
                  maxLength={MAX}
                  value={form.comment}
                  onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                  placeholder="What did you like? What could be better? (optional)"
                />
                <p className="mt-1 text-right text-[11px] text-ink-400">{form.comment.length}/{MAX}</p>
              </div>
              {formError && <p className="text-[13px] text-red-600">{formError}</p>}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" loading={saving}>
                  {mine ? 'Save changes' : 'Post review'}
                </Button>
                {mine && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          ) : (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink-900">Your review</p>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={startEditing}>
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={remove} className="text-red-600 hover:bg-red-50 hover:text-red-700">
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete
                  </Button>
                </div>
              </div>
              <div className="mt-2"><Stars value={mine.rating} /></div>
              {mine.comment && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-700">{mine.comment}</p>}
              {mine.hidden && (
                <p className="mt-3 flex items-center gap-1.5 text-[12px] text-amber-700">
                  <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                  Hidden by the admin team, so only you can see it.
                </p>
              )}
              {formError && <p className="mt-2 text-[13px] text-red-600">{formError}</p>}
            </div>
          )}
        </div>
      )}

      {/* --- everyone else's reviews --- */}
      {others.length > 0 && (
        <ul className="mt-6 divide-y divide-ink-100">
          {others.map((review) => (
            <li key={review.id} className="flex gap-3 py-4 first:pt-0 last:pb-0">
              <Avatar name={review.reviewer} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-sm font-semibold text-ink-900">{review.reviewer}</p>
                  <Stars value={review.rating} size="h-3.5 w-3.5" />
                  <span className="text-[12px] text-ink-400">{formatDate(review.createdAt)}</span>
                </div>
                {review.comment && <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-700">{review.comment}</p>}
                {review.editedByAdmin && <p className="mt-1 text-[11px] text-ink-400">Edited by the admin team</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
