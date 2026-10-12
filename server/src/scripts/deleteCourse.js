/**
 * Delete a course and everything attached to it:
 *
 *   npm run delete:course -- --course=<id|slug>            dry run
 *   npm run delete:course -- --course=<id|slug> --apply     actually delete
 *
 * Removes the course document, its lessons, every student's progress on
 * those lessons, its access grants and its resources.
 *
 * This replaces an earlier version that was hardcoded to a course named
 * "lms" and deleted immediately with no preview. Deleting a course throws
 * away watch history that cannot be recovered, so it now names everything it
 * is about to destroy and does nothing without --apply.
 */
require('dotenv').config();

const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Progress = require('../models/Progress');
const CourseAccess = require('../models/CourseAccess');
const Resource = require('../models/Resource');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const COURSE_ARG = (args.find((a) => a.startsWith('--course=')) || '')
  .split('=')
  .slice(1)
  .join('=')
  .trim();

async function main() {
  if (!COURSE_ARG) {
    console.error('\n  ✗ Which course? Pass --course=<id or slug>.');
    console.error('    npm run delete:course -- --course=react\n');
    process.exit(1);
  }

  await connectDB();

  const course = /^[0-9a-f]{24}$/i.test(COURSE_ARG)
    ? await Course.findById(COURSE_ARG)
    : await Course.findOne({ slug: COURSE_ARG });

  if (!course) {
    console.error(`\n  ✗ No course matches "${COURSE_ARG}".`);
    const all = await Course.find().select('title slug').lean();
    if (all.length) {
      console.error('    Existing courses:');
      all.forEach((c) => console.error(`      ${c._id}  ${c.slug}  — ${c.title}`));
    }
    console.error('');
    await mongoose.disconnect();
    process.exit(1);
  }

  const lessons = await Lesson.find({ courseId: course._id }).select('_id title');
  const lessonIds = lessons.map((l) => l._id);

  const [progressCount, grantCount, resourceCount] = await Promise.all([
    Progress.countDocuments({ lessonId: { $in: lessonIds } }),
    CourseAccess.countDocuments({ courseId: course._id }),
    Resource.countDocuments({ courseId: course._id }),
  ]);

  console.log(`\n  ${APPLY ? 'Deleting' : 'Dry run —'} "${course.title}"  (${course._id})\n`);
  console.log(`    lessons        ${lessons.length}`);
  console.log(`    progress rows  ${progressCount}  (student watch history — not recoverable)`);
  console.log(`    access grants  ${grantCount}`);
  console.log(`    resources      ${resourceCount}`);

  if (lessons.length) {
    console.log('\n    Lessons that will go:');
    lessons.forEach((l) => console.log(`      • ${l.title}`));
  }

  if (!APPLY) {
    console.log('\n  Nothing was deleted. Re-run with --apply:');
    console.log(`    npm run delete:course -- --course=${COURSE_ARG} --apply\n`);
    await mongoose.disconnect();
    return;
  }

  await Progress.deleteMany({ lessonId: { $in: lessonIds } });
  await Lesson.deleteMany({ courseId: course._id });
  await CourseAccess.deleteMany({ courseId: course._id });
  await Resource.deleteMany({ courseId: course._id });
  await Course.deleteOne({ _id: course._id });

  console.log(`\n  ✓ Deleted "${course.title}" and everything attached to it.\n`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('\n[delete:course] failed:', err.message, '\n');
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
