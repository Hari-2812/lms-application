import {
  BarChart3,
  Braces,
  Brain,
  Database,
  LineChart,
  Megaphone,
  Palette,
  Server,
  Code2,
} from 'lucide-react';

/**
 * Presentation helpers for course records returned by /api/courses.
 *
 * Nothing here invents data: fields the API does not provide (rating,
 * studentsCount, category…) simply resolve to null and the UI omits them.
 */

/** Accent gradients used by the generated course artwork. */
export const ACCENTS = {
  sky: { from: '#2450eb', to: '#3b82f6', soft: 'bg-primary-50 text-primary-700' },
  emerald: { from: '#047857', to: '#10b981', soft: 'bg-emerald-50 text-emerald-700' },
  violet: { from: '#5b21b6', to: '#8b5cf6', soft: 'bg-violet-50 text-violet-700' },
  amber: { from: '#b45309', to: '#f59e0b', soft: 'bg-amber-50 text-amber-700' },
  rose: { from: '#9f1239', to: '#f43f5e', soft: 'bg-rose-50 text-rose-700' },
};

export const accentOf = (course) => ACCENTS[course?.accent] || ACCENTS.sky;

/** Icon for a category name, falling back to a generic one. */
const CATEGORY_ICONS = [
  [/web|frontend|react/i, Code2],
  [/backend|node|api|server/i, Server],
  [/data|database|mongo|sql/i, Database],
  [/design|ui|ux/i, Palette],
  [/market/i, Megaphone],
  [/business|finance/i, LineChart],
  [/ai|machine|ml/i, Brain],
  [/analytics|science/i, BarChart3],
];

export function categoryIcon(name = '') {
  const match = CATEGORY_ICONS.find(([pattern]) => pattern.test(name));
  return match ? match[1] : Braces;
}

/** Groups the live catalogue into categories with real course counts. */
export function categoriesFrom(courses = []) {
  const map = new Map();

  for (const course of courses) {
    const name = course.category || 'General';
    const entry = map.get(name) || { name, count: 0, courses: [] };
    entry.count += 1;
    entry.courses.push(course);
    map.set(name, entry);
  }

  return [...map.values()]
    .sort((a, b) => b.count - a.count)
    .map((entry) => ({ ...entry, icon: categoryIcon(entry.name) }));
}

/** Groups the catalogue by instructor, with real course and student totals. */
export function instructorsFrom(courses = []) {
  const map = new Map();

  for (const course of courses) {
    const name = course.instructor;
    if (!name) continue;

    const entry = map.get(name) || {
      name,
      title: course.instructorTitle || '',
      courseCount: 0,
      studentsCount: 0,
      categories: new Set(),
    };
    entry.courseCount += 1;
    entry.studentsCount += course.studentsCount || 0;
    if (course.category) entry.categories.add(course.category);
    if (!entry.title && course.instructorTitle) entry.title = course.instructorTitle;
    map.set(name, entry);
  }

  return [...map.values()]
    .map((entry) => ({ ...entry, categories: [...entry.categories] }))
    .sort((a, b) => b.courseCount - a.courseCount);
}

/** "Free" / "₹1,499" — the API stores price in whole rupees, 0 meaning free. */
export function formatPrice(price) {
  if (!price) return 'Free';
  return `₹${Number(price).toLocaleString('en-IN')}`;
}

/** 1840 -> "1.8k" for compact card metadata. */
export function compactNumber(value) {
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value < 1000) return String(value);
  return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
}

/** 8 -> "8h 00m"; supports fractional hours from the API. */
export function formatHours(hours) {
  if (!hours) return null;
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  return minutes ? `${whole}h ${minutes}m` : `${whole}h`;
}

/**
 * Watch time, phrased at a sensible scale: "0m" / "25m" / "1h 20m" / "8.4h".
 * Seconds in, because a few minutes of watching should not round to "0.0h".
 */
export function formatWatchTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 60) return `${Math.max(0, Math.round((seconds || 0) / 60))}m`;

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours < 10 ? (rest ? `${hours}h ${rest}m` : `${hours}h`) : `${(seconds / 3600).toFixed(1)}h`;
}

/** not-started | in-progress | completed — used by the My Courses tabs. */
export function courseStatus(course) {
  if (!course) return 'not-started';
  if (course.progress >= 100) return 'completed';
  if (course.progress > 0) return 'in-progress';
  return 'not-started';
}

/**
 * Recommends courses the student has not started yet, preferring ones that
 * share a category with what they are already learning.
 */
export function recommendFrom(courses = [], limit = 3) {
  const active = courses.filter((c) => c.progress > 0);
  const activeCategories = new Set(active.map((c) => c.category).filter(Boolean));

  return courses
    .filter((c) => !c.progress)
    .sort((a, b) => {
      const aMatch = activeCategories.has(a.category) ? 1 : 0;
      const bMatch = activeCategories.has(b.category) ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
      return (b.rating || 0) - (a.rating || 0);
    })
    .slice(0, limit);
}
