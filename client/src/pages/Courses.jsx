import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import Button from '../components/common/Button.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import CourseGrid from '../components/courses/CourseGrid.jsx';
import { ErrorState } from '../components/States.jsx';
import { usePageMeta } from '../components/layout/DashboardLayout.jsx';
import useCourses from '../hooks/useCourses.js';
import useWishlist from '../hooks/useWishlist.js';

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

/**
 * Public course catalogue with search and level filters.
 * Filter state lives in the URL so results can be linked to and shared.
 */
export default function Courses() {
  const { courses, status, error } = useCourses();
  const { ids: wishlist, toggle: toggleWishlist } = useWishlist();
  const [params, setParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);

  usePageMeta('Browse Courses', 'Explore the full catalogue and find what to learn next.');

  const query = params.get('q') || '';
  const level = params.get('level') || '';

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return courses.filter((course) => {
      if (level && course.level !== level) return false;
      if (!needle) return true;

      return [course.title, course.description, course.instructor, course.category]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(needle));
    });
  }, [courses, query, level]);

  const hasFilters = Boolean(query || level);

  if (status === 'error') {
    return (
      <div className="container py-16">
        <ErrorState message={error} />
      </div>
    );
  }

  return (
    <>
      <section className="border-b border-ink-100 bg-mesh">
        <div className="container py-12 lg:py-16">
          <p className="eyebrow">Course catalogue</p>
          <h1 className="mt-3 text-[2rem] tracking-tight sm:text-display-sm">
            Explore our courses
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-600">
            Learn from carefully designed courses created to help you build practical skills — each
            one broken into short, ordered lessons.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <label htmlFor="course-search" className="sr-only">
                Search courses
              </label>
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
                aria-hidden="true"
              />
              <input
                id="course-search"
                type="search"
                value={query}
                onChange={(e) => setParam('q', e.target.value)}
                placeholder="Search by title, topic or instructor…"
                className="h-12 w-full rounded-xl border border-ink-200 bg-white pl-11 pr-4 text-sm
                           shadow-xs transition placeholder:text-ink-400 focus:border-primary-500
                           focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>

            <Button
              variant="secondary"
              size="lg"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              className="sm:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Filters
            </Button>
          </div>
        </div>
      </section>

      <section className="container py-10 lg:py-12">
        <div className={`${showFilters ? 'block' : 'hidden'} space-y-4 sm:block`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-ink-500">
              Level
            </span>
            <button
              type="button"
              onClick={() => setParam('level', '')}
              aria-pressed={!level}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${
                !level ? 'bg-primary-600 text-white' : 'bg-ink-100 text-ink-700 hover:bg-ink-200'
              }`}
            >
              All
            </button>
            {LEVELS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setParam('level', item)}
                aria-pressed={level === item}
                className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${
                  level === item
                    ? 'bg-primary-600 text-white'
                    : 'bg-ink-100 text-ink-700 hover:bg-ink-200'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-600" aria-live="polite">
            {status === 'loading'
              ? 'Loading courses…'
              : `${results.length} ${results.length === 1 ? 'course' : 'courses'}`}
          </p>

          {hasFilters && (
            <button
              type="button"
              onClick={() => setParams({}, { replace: true })}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-600 transition hover:text-ink-900"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Clear filters
            </button>
          )}
        </div>

        <div className="mt-6">
          {status !== 'loading' && results.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No courses match those filters"
              description="Try a different search term, or clear the filters to see the whole catalogue."
              action={
                <Button variant="secondary" onClick={() => setParams({}, { replace: true })}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <CourseGrid
              courses={results}
              loading={status === 'loading'}
              skeletonCount={6}
              wishlist={wishlist}
              onToggleSave={toggleWishlist}
            />
          )}
        </div>
      </section>
    </>
  );
}
