/**
 * Build the catalogue FROM Google Drive: npm run drive:import
 *
 *   npm run drive:import                      dry run — prints what it would do
 *   npm run drive:import -- --apply           create / update courses + lessons
 *   npm run drive:import -- --apply --replace also delete the seeded demo courses
 *   npm run drive:import -- --apply --prune   also delete lessons whose Drive file is gone
 *   npm run drive:import -- --title="My Course"   name the course (flat folder only)
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
  return files
    .map((file, index) => ({
      videoFileId: file.id,
      title: titleFromFilename(file.name),
      fileName: file.name,
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
  const existing = await Lesson.find({ courseId: course._id }).select('+videoFileId');
  const byFileId = new Map(existing.map((l) => [l.videoFileId, l]));

  let created = 0;
  let updated = 0;

  for (const spec of lessons) {
    const current = byFileId.get(spec.videoFileId);

    if (current) {
      current.title = spec.title;
      current.order = spec.order;
      if (spec.duration) current.duration = spec.duration;
      await current.save();
      updated += 1;
      byFileId.delete(spec.videoFileId);
    } else {
      await Lesson.create({
        courseId: course._id,
        videoFileId: spec.videoFileId,
        title: spec.title,
        description: '',
        order: spec.order,
        duration: spec.duration,
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

async function main() {
  if (!driveService.isConfigured()) {
    console.error('\n  ✗ Drive is not configured. Run `npm run drive:check` first.\n');
    process.exit(1);
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
