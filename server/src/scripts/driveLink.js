/**
 * Map Drive files onto lessons: npm run drive:link
 *
 *   npm run drive:link                 dry run — prints the proposed mapping
 *   npm run drive:link -- --apply      writes videoFileId (and real duration)
 *   npm run drive:link -- --course=react --apply     scope to one course slug
 *   npm run drive:link -- --positional               allow order-only matching
 *   npm run drive:link -- --set "React Hooks=1AbC..."   link one lesson by hand
 *
 * Matching, in order of confidence:
 *   1. a leading number in the filename ("03 - Components.mp4" -> lesson 3)
 *   2. a near-identical filename and lesson title
 *
 * A lesson with no confident match is reported and left alone. Ordering files
 * against lessons with no name evidence is only done with --positional, and
 * only when the counts line up exactly.
 *
 * Only `videoFileId` and `duration` are written. Courses, progress and every
 * other lesson field are left untouched, so this is safe to re-run.
 */
require('dotenv').config();

const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const driveService = require('../services/googleDriveService');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const POSITIONAL = args.includes('--positional');
const COURSE_SLUG = (args.find((a) => a.startsWith('--course=')) || '').split('=')[1] || null;

/** --set "Title=fileId" (two args) or --set=Title=fileId (one arg). */
const SET_SPEC = (() => {
  const inline = args.find((a) => a.startsWith('--set='));
  if (inline) return inline.slice('--set='.length);
  const flagIndex = args.indexOf('--set');
  return flagIndex >= 0 ? args[flagIndex + 1] || '' : null;
})();

const STOP_WORDS = new Set(['the', 'a', 'an', 'to', 'of', 'and', 'in', 'for', 'with', 'your', 'lesson', 'part', 'video']);

/**
 * Pull an ordering number and comparable words out of a filename.
 *
 *   "03 - React Components.mp4"    -> { order: 3, tokens: ['react','components'] }
 *   "Introduction to React-3.mp4"  -> { order: 3, tokens: ['introduction','react'] }
 *
 * Both a leading number ("03 - ...") and a trailing one ("...-3") are common
 * ways of numbering an export, so accept either.
 */
function parseName(raw) {
  const withoutExtension = raw.replace(/\.[a-z0-9]+$/i, '');

  const leading = /^\s*(\d{1,3})\s*[-_.)\]]*\s+/.exec(withoutExtension);
  const trailing = /[-_ .(]\s*(\d{1,3})\s*\)?$/.exec(withoutExtension);
  const order = leading ? Number(leading[1]) : trailing ? Number(trailing[1]) : null;

  const tokens = withoutExtension
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t && t.length > 1 && !STOP_WORDS.has(t) && !/^\d+$/.test(t));

  return { order, tokens };
}

/** Word overlap, 0..1, normalised by the smaller token set. */
function similarity(a, b) {
  if (!a.length || !b.length) return 0;
  const setB = new Set(b);
  const hits = a.filter((t) => setB.has(t)).length;
  return hits / Math.min(a.length, b.length);
}

/**
 * A name-only match has to be strong. "Introduction to Node.js" and
 * "Introduction to React.mp4" share one word out of two — that is a 0.5 and
 * must NOT be treated as a match.
 */
const WORD_MATCH_THRESHOLD = 0.75;

/**
 * @param usedFiles shared across every course, so one Drive file can never be
 *                  attached to two different lessons.
 */
function buildMapping(lessons, files, usedFiles) {
  const available = files.filter((file) => !usedFiles.has(file.id));
  const parsedFiles = available.map((file) => ({ ...file, ...parseName(file.name) }));
  const parsedLessons = lessons.map((lesson) => ({
    lesson,
    tokens: parseName(lesson.title).tokens,
  }));

  // Score every (lesson, file) pair, then assign greedily from the best down
  // so a strong match cannot be stolen by a weaker one earlier in the list.
  const pairs = [];
  for (const { lesson, tokens } of parsedLessons) {
    for (const file of parsedFiles) {
      const wordScore = similarity(tokens, file.tokens);
      const orderBonus = file.order === lesson.order ? 0.6 : 0;
      // Without a matching leading number, only a near-identical name counts.
      if (!orderBonus && wordScore < WORD_MATCH_THRESHOLD) continue;
      pairs.push({ lesson, file, score: wordScore + orderBonus, wordScore, orderBonus });
    }
  }
  pairs.sort((a, b) => b.score - a.score);

  const byLesson = new Map();

  for (const pair of pairs) {
    if (byLesson.has(String(pair.lesson._id)) || usedFiles.has(pair.file.id)) continue;

    // Flag a tie: two files score identically for this lesson, so whichever we
    // pick is arbitrary and the user should confirm it.
    pair.ambiguousWith = pairs
      .filter(
        (other) =>
          other !== pair &&
          other.lesson === pair.lesson &&
          other.score === pair.score &&
          !usedFiles.has(other.file.id)
      )
      .map((other) => other.file.name);

    byLesson.set(String(pair.lesson._id), pair);
    usedFiles.add(pair.file.id);
  }

  // Positional fallback: opt-in only.
  //
  // Matching purely on ordering happily pairs "Introduction to React.mp4" with
  // a MongoDB lesson whenever the counts happen to line up, which is worse
  // than leaving the lesson unlinked. Enable with --positional once you have
  // checked the dry run.
  const unmatched = parsedLessons.filter(({ lesson }) => !byLesson.has(String(lesson._id)));
  const freeFiles = parsedFiles.filter((f) => !usedFiles.has(f.id));

  if (POSITIONAL && unmatched.length && unmatched.length === freeFiles.length) {
    const orderedLessons = [...unmatched].sort((a, b) => a.lesson.order - b.lesson.order);
    const orderedFiles = [...freeFiles].sort((a, b) =>
      (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name)
    );
    orderedLessons.forEach(({ lesson }, i) => {
      byLesson.set(String(lesson._id), {
        lesson,
        file: orderedFiles[i],
        score: 0,
        positional: true,
      });
    });
  }

  return byLesson;
}

/**
 * `--set "React Components=1AbC..."` — attach one Drive file to one lesson by
 * title, for ties and anything the matcher left alone. Always writes.
 */
async function runManualSet(spec, files) {
  const index = spec.lastIndexOf('=');
  if (index < 1) {
    console.error('\n  ✗ Expected --set "<lesson title>=<drive file id>"\n');
    process.exit(1);
  }

  const title = spec.slice(0, index).trim();
  const fileId = spec.slice(index + 1).trim();

  await connectDB();

  const lessons = await Lesson.find({
    title: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
  }).select('+videoFileId');

  if (lessons.length === 0) {
    console.error(`\n  ✗ No lesson titled "${title}".\n`);
    await mongoose.disconnect();
    process.exit(1);
  }
  if (lessons.length > 1) {
    console.error(`\n  ✗ ${lessons.length} lessons share that title. Use --course= to narrow it.\n`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const file = files.find((f) => f.id === fileId);
  if (!file) {
    console.error(`\n  ✗ No file with id ${fileId} in the Drive folder.`);
    console.error('    Run `npm run drive:check` to list the ids.\n');
    await mongoose.disconnect();
    process.exit(1);
  }

  const lesson = lessons[0];
  lesson.videoFileId = file.id;
  if (file.durationSeconds) lesson.duration = file.durationSeconds;
  await lesson.save();

  console.log(`\n  ✓ "${lesson.title}" -> ${file.name}\n`);
  await mongoose.disconnect();
}

async function main() {
  const summary = driveService.getConfigSummary();
  if (!summary.configured) {
    console.error('\n  ✗ Drive is not configured. Run `npm run drive:check` first.\n');
    process.exit(1);
  }

  const files = await driveService.listFolderVideos();
  if (!files.length) {
    console.error('\n  ✗ No video files in the Drive folder. Run `npm run drive:check`.\n');
    process.exit(1);
  }

  if (SET_SPEC) {
    await runManualSet(SET_SPEC, files);
    return;
  }

  await connectDB();

  const courseQuery = COURSE_SLUG ? { slug: COURSE_SLUG } : {};
  const courses = await Course.find(courseQuery).sort({ createdAt: 1 });

  if (!courses.length) {
    console.error(`\n  ✗ No course found${COURSE_SLUG ? ` with slug "${COURSE_SLUG}"` : ''}.\n`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`\n  ${APPLY ? 'Applying' : 'Dry run —'} Drive file mapping`);
  console.log(`  ${files.length} Drive video(s), ${courses.length} course(s)\n`);

  let willWrite = 0;
  let unresolved = 0;
  let ambiguous = 0;
  // Shared across courses so a Drive file is never linked to two lessons.
  const usedFiles = new Set();

  for (const course of courses) {
    const lessons = await Lesson.find({ courseId: course._id })
      .select('+videoFileId')
      .sort({ order: 1 });

    if (!lessons.length) continue;

    console.log(`  ${course.title}`);
    console.log('  ' + '─'.repeat(60));

    const mapping = buildMapping(lessons, files, usedFiles);

    for (const lesson of lessons) {
      const match = mapping.get(String(lesson._id));

      if (!match) {
        unresolved += 1;
        console.log(`   ?  ${lesson.order}. ${lesson.title}`);
        console.log('      no confident match — set videoFileId manually');
        continue;
      }

      const how = match.positional
        ? 'by position'
        : match.orderBonus
          ? 'by number + name'
          : `by name (${Math.round(match.wordScore * 100)}%)`;

      const alreadyLinked = lesson.videoFileId === match.file.id;
      console.log(`   ${alreadyLinked ? '=' : '→'}  ${lesson.order}. ${lesson.title}`);
      console.log(`      ${match.file.name}  [${how}]`);

      if (match.ambiguousWith?.length) {
        ambiguous += 1;
        console.log(`      ⚠ scores the same as: ${match.ambiguousWith.join(', ')}`);
        console.log('        rename the files so the intended one is unambiguous');
      }

      if (alreadyLinked) continue;
      willWrite += 1;

      if (APPLY) {
        lesson.videoFileId = match.file.id;
        // The seeded durations were placeholders; use the real media length so
        // the curriculum shows accurate lesson times.
        if (match.file.durationSeconds) lesson.duration = match.file.durationSeconds;
        await lesson.save();
      }
    }

    console.log('');
  }

  const unusedFiles = files.filter((file) => !usedFiles.has(file.id));

  if (APPLY) {
    console.log(`  ✓ Updated ${willWrite} lesson(s).`);
    if (unresolved) {
      console.log(`  ${unresolved} lesson(s) still have no video and will fall back to`);
      console.log('  server/demo-media/sample.mp4 until you upload and link theirs.');
    }
    console.log('\n  Restart the API and play a linked lesson — it now streams from Drive.\n');
  } else {
    console.log(`  ${willWrite} lesson(s) would be updated.`);
    if (unresolved) console.log(`  ${unresolved} lesson(s) had no confident match.`);
    if (ambiguous) console.log(`  ${ambiguous} match(es) were ties — check them above.`);
    console.log('\n  Re-run with --apply to write:  npm run drive:link -- --apply\n');
  }

  if (unusedFiles.length) {
    console.log('  Drive files not matched to any lesson:');
    unusedFiles.forEach((file) => console.log(`   • ${file.name}`));
    console.log('');
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('\n[drive:link] failed:', err.message, '\n');
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
