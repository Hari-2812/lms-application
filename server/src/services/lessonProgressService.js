const Lesson = require('../models/Lesson');
const Progress = require('../models/Progress');
const settingsService = require('./settingsService');

/**
 * Watch tracking and sequential lesson unlocking.
 *
 * WATCHED TIME
 * The player reports the spans of the video it actually played (the
 * browser's `video.played` ranges). They are merged with what was stored
 * before, and a lesson's percent is the share of the video those spans cover
 * — so dragging the seek bar to the end does not count as watching it.
 *
 * Credited time is also capped by how much wall-clock time has passed since
 * the learner's first report for the lesson, so a hand-made API call cannot
 * claim a whole video at once.
 *
 * SEQUENTIAL UNLOCKING  (Settings → learning.sequentialLessons, on by default)
 * A learner can open every lesson they have completed, plus the first one
 * they have not. Everything after that stays locked until the lesson before
 * it is completed. Staff are never locked out. Enforced here on the API —
 * lesson details, the video stream and progress saves — not just in the UI.
 */

const MAX_RANGES = 200;
// Spans closer together than this are merged (seek jitter, timeupdate granularity).
const MERGE_GAP_SECONDS = 0.5;
// Coverage this close to the full duration counts as the whole video.
const END_TOLERANCE_SECONDS = 1;
// The longest lesson video we accept a report for.
const MAX_DURATION_SECONDS = 24 * 60 * 60;

// Total watched time a row may hold: this much, plus CREDIT_RATE seconds per
// wall-clock second since its first report (2x playback speed plus jitter).
// The player's first report goes out within a second of pressing play.
const FIRST_REPORT_CREDIT_SECONDS = 30;
const CREDIT_RATE = 2.2;

/* --------------------------------------------------------------- ranges */

/** Sorted, merged copy of [{ start, end }] spans. */
function mergeRanges(ranges) {
  const sorted = ranges
    .filter((r) => Number.isFinite(r.start) && Number.isFinite(r.end) && r.end > r.start)
    .map((r) => ({ start: r.start, end: r.end }))
    .sort((a, b) => a.start - b.start);

  const merged = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end + MERGE_GAP_SECONDS) last.end = Math.max(last.end, range.end);
    else merged.push(range);
  }
  return merged;
}

/** Whatever the client sent → valid spans inside [0, duration], merged. */
function normaliseRanges(raw, duration) {
  if (!Array.isArray(raw)) return [];
  const spans = [];
  for (const item of raw.slice(0, 1000)) {
    const start = Number(Array.isArray(item) ? item[0] : item?.start);
    const end = Number(Array.isArray(item) ? item[1] : item?.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    spans.push({ start: Math.max(0, start), end: Math.min(duration, end) });
  }
  return mergeRanges(spans);
}

/** Parts of `ranges` not already covered by `covered` (both merged). */
function subtractRanges(ranges, covered) {
  const out = [];
  for (const range of ranges) {
    let cursor = range.start;
    for (const c of covered) {
      if (c.end <= cursor) continue;
      if (c.start >= range.end) break;
      if (c.start > cursor) out.push({ start: cursor, end: c.start });
      cursor = Math.max(cursor, c.end);
      if (cursor >= range.end) break;
    }
    if (cursor < range.end) out.push({ start: cursor, end: range.end });
  }
  return out;
}

const totalLength = (ranges) => ranges.reduce((sum, r) => sum + (r.end - r.start), 0);

/** Keeps the list bounded by joining the spans with the smallest gaps between them. */
function limitRangeCount(ranges) {
  const list = ranges.map((r) => ({ ...r }));
  while (list.length > MAX_RANGES) {
    let smallest = 0;
    for (let i = 1; i < list.length - 1; i += 1) {
      if (list[i + 1].start - list[i].end < list[smallest + 1].start - list[smallest].end) smallest = i;
    }
    list[smallest].end = list[smallest + 1].end;
    list.splice(smallest + 1, 1);
  }
  return list;
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * The duration to measure the lesson against. The browser's figure is used,
 * unless it is less than half of Drive's own metadata for the file — that
 * only happens when the report was tampered with or the stream is broken.
 */
function effectiveDuration(reported, lesson) {
  const metadata = Number(lesson?.duration) || 0;
  if (metadata > 0 && reported < metadata * 0.5) return metadata;
  return reported;
}

/**
 * Applies one progress report from the player to the stored row.
 *
 *   existing  the Progress document, or null on the first report
 *   report    { position, duration, watched } from the request body
 *   lesson    the Lesson (for its Drive duration)
 *
 * Returns { position, duration, watchedRanges, watchedSeconds, percent }, or
 * { error } when the report has no usable duration.
 */
function applyWatchReport(existing, report, lesson, now = Date.now()) {
  const reported = Number(report?.duration);
  if (!Number.isFinite(reported) || reported <= 0 || reported > MAX_DURATION_SECONDS) {
    return { error: 'A valid video duration is required' };
  }
  const duration = effectiveDuration(reported, lesson);

  const rawPosition = Number(report?.position);
  const position = Number.isFinite(rawPosition) ? Math.min(Math.max(0, rawPosition), duration) : 0;

  // Rows saved before watch tracking have no watchedRanges at all (an empty
  // list is a tracked row that has not played anything yet). They only know
  // the furthest position; count everything up to it as watched so nobody
  // loses the progress they had.
  const legacy = Boolean(existing) && existing.watchedRanges == null;
  const stored = normaliseRanges(
    legacy
      ? existing.position > 0
        ? [{ start: 0, end: existing.position }]
        : []
      : (existing?.watchedRanges || []).map((r) => ({ start: r.start, end: r.end })),
    duration
  );

  // A player from before watch tracking (a cached old page) sends only its
  // position; read that the old way, as "watched from the start to here".
  // The time cap below still applies to it.
  const claimed = normaliseRanges(Array.isArray(report?.watched) ? report.watched : [[0, position]], duration);
  const fresh = subtractRanges(claimed, stored);

  // Watched time can only grow as fast as real time passes, measured from the
  // row's first report — so repeated or hand-made calls gain nothing extra.
  // Legacy rows predate the limit and are left uncapped.
  const createdAt = existing?.createdAt ? new Date(existing.createdAt).getTime() : null;
  const allowedTotal = !existing
    ? FIRST_REPORT_CREDIT_SECONDS
    : createdAt === null || legacy
      ? Infinity
      : FIRST_REPORT_CREDIT_SECONDS + (Math.max(0, now - createdAt) / 1000) * CREDIT_RATE;
  let budget = Math.max(0, allowedTotal - totalLength(stored));

  const credited = [];
  for (const span of fresh) {
    if (budget <= 0) break;
    const length = span.end - span.start;
    if (length <= budget) {
      credited.push(span);
      budget -= length;
    } else {
      credited.push({ start: span.start, end: span.start + budget });
      budget = 0;
    }
  }

  const watchedRanges = limitRangeCount(mergeRanges([...stored, ...credited])).map((r) => ({
    start: round2(r.start),
    end: round2(r.end),
  }));
  const watchedSeconds = Math.min(duration, totalLength(watchedRanges));
  const percent =
    duration - watchedSeconds <= END_TOLERANCE_SECONDS ? 100 : Math.min(100, Math.round((watchedSeconds / duration) * 100));

  return { position: round2(position), duration: round2(duration), watchedRanges, watchedSeconds: round2(watchedSeconds), percent };
}

/* ------------------------------------------------------------ unlocking */

/**
 * Given the completed flag of each lesson in course order, which are locked:
 * everything after the first incomplete lesson that is not itself complete.
 */
function lockedFlags(completedFlags) {
  const firstOpen = completedFlags.findIndex((done) => !done);
  if (firstOpen === -1) return completedFlags.map(() => false);
  return completedFlags.map((done, index) => index > firstOpen && !done);
}

/** Whether sequential unlocking applies to this request. */
async function enforcesSequence(access) {
  if (access?.via === 'staff') return false;
  const { learning } = await settingsService.get();
  return learning.sequentialLessons !== false;
}

/** Course order — `order`, then creation, so ties are stable everywhere. */
const COURSE_ORDER = { order: 1, _id: 1 };

/**
 * A lesson, once unlocked, never locks again (completion is permanent), so
 * "unlocked" answers are cached briefly. The video stream asks on every byte
 * range the browser requests; this keeps that to one lookup per lesson.
 */
const unlockedCache = new Map();
const UNLOCKED_TTL_MS = 10 * 60 * 1000;
const UNLOCKED_CACHE_LIMIT = 5000;

function rememberUnlocked(key) {
  if (unlockedCache.size >= UNLOCKED_CACHE_LIMIT) unlockedCache.delete(unlockedCache.keys().next().value);
  unlockedCache.set(key, Date.now() + UNLOCKED_TTL_MS);
}

/** True when this learner may not open the lesson yet. */
async function isLessonLocked({ studentId, courseId, lessonId, access }) {
  if (!(await enforcesSequence(access))) return false;

  const key = `${studentId}:${lessonId}`;
  const cachedUntil = unlockedCache.get(key);
  if (cachedUntil && cachedUntil > Date.now()) return false;

  const [lessons, rows] = await Promise.all([
    Lesson.find({ courseId }).sort(COURSE_ORDER).select('_id').lean(),
    Progress.find({ studentId: String(studentId), courseId, completed: true }).select('lessonId').lean(),
  ]);
  const done = new Set(rows.map((r) => String(r.lessonId)));
  const flags = lockedFlags(lessons.map((l) => done.has(String(l._id))));
  const index = lessons.findIndex((l) => String(l._id) === String(lessonId));

  // A lesson that is not in this course is not ours to lock; the route 404s it.
  if (index === -1) return false;
  if (!flags[index]) rememberUnlocked(key);
  return flags[index];
}

module.exports = {
  applyWatchReport,
  lockedFlags,
  enforcesSequence,
  isLessonLocked,
  COURSE_ORDER,
  // exported for tests
  mergeRanges,
  normaliseRanges,
  subtractRanges,
};
