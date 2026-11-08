/**
 * Build the catalogue FROM Google Drive: npm run drive:import
 *
 *   npm run drive:import                      dry run — prints what it would do
 *   npm run drive:import -- --apply           create / update courses + lessons
 *   npm run drive:import -- --apply --replace also delete the seeded demo courses
 *   npm run drive:import -- --apply --prune   also delete lessons whose Drive file is gone
 *   npm run drive:import -- --title="My Course"   name the course (flat folder only)
 *
 * Targeted mode — fill ONE existing course from ONE Drive folder:
 *
 *   npm run drive:import -- --course=<id|slug> --folder=<folder id or URL>
 *   npm run drive:import -- --course=<id|slug> --folder=<...> --apply
 *
 * Use this to re-attach videos to a course that already exists but has no
 * lessons (see `npm run restore:courses`). Ordinary mode matches a Drive
 * folder to a course by driveFolderId or slug, which would create a second
 * course alongside the one you meant to fill; targeted mode writes the
 * lessons onto the course you name and records the folder id on it, so later
 * runs match it automatically.
 *
 * Drive layout drives the structure:
 *
 *   lms/                          <- GOOGLE_DRIVE_FOLDER_ID
 *   ├── React Basics/             <- becomes a course
 *   │   ├── 01 Intro.mp4          <- becomes lesson 1
 *   │   └── 02 Components.mp4     <- becomes lesson 2
 *   └── Node API/                 <- becomes another course
 *
 * If the root folder has no sub-folders, every video in it becomes one course.
 *
 * Re-runnable: lessons are matched by Drive file id, so titles/orders/durations
 * refresh while watch progress is preserved.
 */
require('dotenv').config();

const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Progress = require('../models/Progress');
const driveService = require('../services/googleDriveService');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const REPLACE = args.includes('--replace');
const PRUNE = args.includes('--prune');
const TITLE_ARG = (args.find((a) => a.startsWith('--title=')) || '').split('=').slice(1).join('=');

/** Value of a --key=value flag, or '' when absent. */
const flag = (name) =>
  (args.find((a) => a.startsWith(`--${name}=`)) || '').split('=').slice(1).join('=').trim();

// Targeted mode: attach ONE Drive folder's videos to ONE existing course,
// instead of deriving the whole catalogue from the root folder. Added for
// recovery — a restored course has no driveFolderId, so ordinary matching
// would build a duplicate course beside it rather than filling it.
const FOLDER_ARG = flag('folder');
const COURSE_ARG = flag('course');

/** "01 - Intro to React.mp4" -> "Intro to React"; "Lesson-3.mp4" -> "Lesson 3" */
function titleFromFilename(name) {
  let title = name.replace(/\.[a-z0-9]+$/i, '');
  title = title.replace(/^\s*\d{1,3}\s*[-_.)\]]+\s*/, ''); // drop a leading "01 - "
  title = title.replace(/_+/g, ' ');
  title = title.replace(/\s*-\s*(\d{1,3})\s*$/, ' $1'); // "React-3" -> "React 3"
  title = title.replace(/\s+/g, ' ').trim();
  return title || name;
}

/** Leading or trailing number in the filename, used for lesson ordering. */
function orderFromFilename(name) {
  const base = name.replace(/\.[a-z0-9]+$/i, '');
  const leading = /^\s*(\d{1,3})\b/.exec(base);
  if (leading) return Number(leading[1]);
  const trailing = /[-_ .(]\s*(\d{1,3})\s*\)?$/.exec(base);
  return trailing ? Number(trailing[1]) : null;
}

function slugify(text) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'course'
  );
}

const ACCENTS = ['sky', 'emerald', 'violet', 'amber', 'rose'];

/** Turn a folder's video list into ordered lesson descriptors. */
function toLessons(files) {
  // A video with downloading turned off can never play, so it would only
  // become a broken lesson. Say which ones were left out and why.
  const blocked = files.filter((file) => file.canDownload === false);
  for (const file of blocked) {
    console.warn(
      `   ! skipped "${file.name}": downloading is turned off in Google Drive, so it cannot be streamed.\n` +
        '     Its owner can allow it: open the file → Share → ⚙ → tick "Viewers and commenters can see the option to download".'
    );
  }
  return files
    .filter((file) => file.canDownload !== false)
    .map((file, index) => ({
      driveFileId: file.id,
      title: titleFromFilename(file.name),
      fileName: file.name,
      mimeType: file.mimeType || 'video/mp4',
      duration: file.durationSeconds || 0,
      sortKey: orderFromFilename(file.name) ?? index + 1,
    }))
    .sort((a, b) => a.sortKey - b.sortKey || a.fileName.localeCompare(b.fileName))
    .map((lesson, index) => ({ ...lesson, order: index + 1 }));
}

/** Read the Drive folder(s) and describe the catalogue they represent. */
async function readDriveCatalogue() {
  const rootId = driveService.getFolderId();
  const root = await driveService.getFolderMetadata(rootId);
  const subFolders = await driveService.listSubFolders(rootId);

  const groups = [];

  for (const folder of subFolders) {
    const files = await driveService.listFolderVideos(folder.id);
    if (files.length) {
      groups.push({ folderId: folder.id, title: folder.name, lessons: toLessons(files) });
    }
  }

  // Flat folder: everything in the root becomes a single course.
  const rootFiles = await driveService.listFolderVideos(rootId);
  if (rootFiles.length) {
    groups.push({
      folderId: rootId,
      title: TITLE_ARG || root.name,
      lessons: toLessons(rootFiles),
    });
  }

  return { root, groups };
}

async function upsertCourse(group, accentIndex) {
  let course = await Course.findOne({ driveFolderId: group.folderId });

  if (!course) {
    // Re-use a same-slug course if one exists, so a second run after renaming
    // does not collide on the unique slug index.
    const slug = slugify(group.title);
    course = await Course.findOne({ slug });
    if (!course) course = new Course({ slug });
  }

  course.title = group.title;
  course.slug = course.slug || slugify(group.title);
  course.driveFolderId = group.folderId;
  course.hasDriveVideos = true;
  if (!course.description) {
    course.description = `${group.lessons.length} video ${
      group.lessons.length === 1 ? 'lesson' : 'lessons'
    } streamed securely from private storage.`;
  }
  course.hours =
    Math.round((group.lessons.reduce((sum, l) => sum + l.duration, 0) / 3600) * 10) / 10;
  if (!course.accent) course.accent = ACCENTS[accentIndex % ACCENTS.length];

  await course.save();
  return course;
}

async function syncLessons(course, lessons) {
  // driveFileId is stripped by Lesson.toJSON() but is a normal selected path,
  // so no explicit +select is needed to read it here.
  const existing = await Lesson.find({ courseId: course._id });
  const byFileId = new Map(existing.map((l) => [l.driveFileId, l]));

  let created = 0;
  let updated = 0;

  for (const spec of lessons) {
    const current = byFileId.get(spec.driveFileId);

    if (current) {
      current.title = spec.title;
      current.order = spec.order;
      current.driveFileName = spec.fileName;
      if (spec.mimeType) current.mimeType = spec.mimeType;
      if (spec.duration) current.duration = spec.duration;
      await current.save();
      updated += 1;
      byFileId.delete(spec.driveFileId);
    } else {
      await Lesson.create({
        courseId: course._id,
        driveFileId: spec.driveFileId,
        driveFileName: spec.fileName,
        mimeType: spec.mimeType,
        title: spec.title,
        description: '',
        order: spec.order,
        duration: spec.duration,
        folderId: course.driveFolderId,
      });
      created += 1;
    }
  }

  // Whatever is left was not in the Drive folder any more.
  const stale = [...byFileId.values()];
  let removed = 0;
  if (PRUNE && stale.length) {
    const ids = stale.map((l) => l._id);
    await Progress.deleteMany({ lessonId: { $in: ids } });
    await Lesson.deleteMany({ _id: { $in: ids } });
    removed = ids.length;
  }

  return { created, updated, stale: stale.length, removed };
}

/**
 * Targeted mode: attach one Drive folder's videos to one existing course.
 *
 * The course is looked up by _id or slug and is never created — if it is not
 * found, that is a typo worth stopping on rather than silently making a new
 * course, which is the exact outcome this mode exists to avoid.
 */
async function importIntoCourse(rawFolder, courseRef) {
  const folderId = driveService.normaliseFolderId(rawFolder);
  if (!folderId) {
    console.error(`\n  ✗ Could not read a Drive folder id from "${rawFolder}".\n`);
    process.exit(1);
  }

  // Read Drive before touching the database, so a bad folder fails cheaply.
  let folder;
  try {
    folder = await driveService.getFolderMetadata(folderId);
  } catch (err) {
    console.error(`\n  ✗ Drive folder ${folderId} is not reachable: ${err.message}`);
    console.error('    Share it with the service account — see npm run drive:check.\n');
    process.exit(1);
  }

  const files = await driveService.listFolderVideos(folderId);
  if (!files.length) {
    console.error(`\n  ✗ No video files found in Drive folder "${folder.name}".\n`);
    process.exit(1);
  }
  const lessons = toLessons(files);

  await connectDB();

  // An ObjectId-shaped ref is looked up by _id, anything else by slug.
  const course = /^[0-9a-f]{24}$/i.test(courseRef)
    ? await Course.findById(courseRef)
    : await Course.findOne({ slug: courseRef });

  if (!course) {
    console.error(`\n  ✗ No course matches "${courseRef}".`);
    const all = await Course.find().select('title slug').lean();
    if (all.length) {
      console.error('    Existing courses:');
      all.forEach((c) => console.error(`      ${c._id}  ${c.slug}  — ${c.title}`));
    }
    console.error('');
    await mongoose.disconnect();
    process.exit(1);
  }

  const existingLessons = await Lesson.countDocuments({ courseId: course._id });

  console.log(`\n  ${APPLY ? 'Importing' : 'Dry run —'} Drive folder "${folder.name}"`);
  console.log(`  into course "${course.title}"  (${course._id})\n`);
  console.log(`  course currently has ${existingLessons} lesson(s)`);
  console.log(`  folder has ${lessons.length} video(s):\n`);

  lessons.forEach((lesson) => {
    const mins = lesson.duration
      ? `${Math.floor(lesson.duration / 60)}:${String(lesson.duration % 60).padStart(2, '0')}`
      : '—';
    console.log(`   ${String(lesson.order).padStart(2, '0')}. ${lesson.title}`);
    console.log(`       ${lesson.fileName}  ${mins}`);
  });

  if (!APPLY) {
    console.log('\n  Nothing was written. Re-run with --apply to write these lessons:');
    console.log(`    npm run drive:import -- --course=${courseRef} --folder=${folderId} --apply\n`);
    await mongoose.disconnect();
    return;
  }

  const stats = await syncLessons(course, lessons);

  // Recording the folder id is what makes a later plain `drive:import` update
  // this course instead of building a duplicate beside it.
  course.driveFolderId = folderId;
  course.hasDriveVideos = true;
  course.hours = Math.round((lessons.reduce((sum, l) => sum + l.duration, 0) / 3600) * 10) / 10;

  const ordered = await Lesson.find({ courseId: course._id }).sort({ order: 1 }).select('_id');
  course.lessons = ordered.map((l) => l._id);
  await course.save();

  console.log(
    `\n  ✓ ${course.title}: ${stats.created} created, ${stats.updated} updated` +
      (stats.stale
        ? `, ${stats.stale} existing lesson(s) absent from this folder${
            PRUNE ? ` (${stats.removed} removed)` : ' (left alone; --prune removes them)'
          }`
        : '')
  );
  console.log(`    lessons now: ${course.lessons.length}   hours: ${course.hours}`);
  console.log('    driveFolderId recorded, so future runs match this course.\n');

  await mongoose.disconnect();
}

async function main() {
  if (!driveService.isConfigured()) {
    console.error('\n  ✗ Drive is not configured. Run `npm run drive:check` first.\n');
    process.exit(1);
  }

  // Targeted mode needs both flags; one without the other is a mistake that
  // should not be quietly reinterpreted as a full-catalogue import.
  if (FOLDER_ARG || COURSE_ARG) {
    if (!FOLDER_ARG || !COURSE_ARG) {
      console.error('\n  ✗ --folder and --course must be used together.');
      console.error('    npm run drive:import -- --course=<id|slug> --folder=<folder id or URL>\n');
      process.exit(1);
    }
    return importIntoCourse(FOLDER_ARG, COURSE_ARG);
  }

  if (!driveService.getFolderId()) {
    console.error('\n  ✗ GOOGLE_DRIVE_FOLDER_ID is not set. Run `npm run drive:check`.\n');
    process.exit(1);
  }

  const { root, groups } = await readDriveCatalogue();

  if (groups.length === 0) {
    console.error(`\n  ✗ No videos found in "${root.name}" or its sub-folders.\n`);
    process.exit(1);
  }

  console.log(`\n  ${APPLY ? 'Importing' : 'Dry run —'} catalogue from Drive folder "${root.name}"\n`);

  for (const group of groups) {
    console.log(`  ${group.title}  (${group.lessons.length} lessons)`);
    console.log('  ' + '─'.repeat(58));
    group.lessons.forEach((lesson) => {
      const mins = lesson.duration
        ? `${Math.floor(lesson.duration / 60)}:${String(lesson.duration % 60).padStart(2, '0')}`
        : '—';
      console.log(`   ${String(lesson.order).padStart(2, '0')}. ${lesson.title}`);
      console.log(`       ${lesson.fileName}  ${mins}`);
    });
    console.log('');
  }

  await connectDB();

  if (!APPLY) {
    const seeded = await Course.find({
      $or: [{ driveFolderId: '' }, { driveFolderId: { $exists: false } }],
    });
    if (seeded.length) {
      console.log('  Existing courses NOT from Drive:');
      seeded.forEach((c) => console.log(`   • ${c.title}`));
      console.log('   (add --replace to delete these and their progress)\n');
    }
    console.log('  Re-run with --apply to write:  npm run drive:import -- --apply\n');
    await mongoose.disconnect();
    return;
  }

  let accentIndex = 0;
  const keptCourseIds = [];

  for (const group of groups) {
    const course = await upsertCourse(group, accentIndex++);
    const stats = await syncLessons(course, group.lessons);

    // The admin dashboard reads its lesson count off Course.lessons, so the
    // array has to track what syncLessons just wrote.
    const ordered = await Lesson.find({ courseId: course._id }).sort({ order: 1 }).select('_id');
    course.lessons = ordered.map((l) => l._id);
    await course.save();

    keptCourseIds.push(course._id);

    console.log(
      `  ✓ ${course.title}: ${stats.created} created, ${stats.updated} updated` +
        (stats.stale ? `, ${stats.stale} no longer in Drive${PRUNE ? ` (${stats.removed} removed)` : ' (use --prune to remove)'}` : '')
    );
  }

  if (REPLACE) {
    const obsolete = await Course.find({
      _id: { $nin: keptCourseIds },
      $or: [{ driveFolderId: '' }, { driveFolderId: { $exists: false } }],
    });

    for (const course of obsolete) {
      const lessons = await Lesson.find({ courseId: course._id });
      const lessonIds = lessons.map((l) => l._id);
      await Progress.deleteMany({ lessonId: { $in: lessonIds } });
      await Lesson.deleteMany({ courseId: course._id });
      await Course.deleteOne({ _id: course._id });
      console.log(`  ✗ removed seeded course "${course.title}" (${lessonIds.length} lessons)`);
    }
  }

  console.log('\n  Done. Reload the app — the catalogue now mirrors your Drive folder.\n');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('\n[drive:import] failed:', err.message, '\n');
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
