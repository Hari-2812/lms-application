/**
 * Partial recovery after `npm run seed` wiped the catalogue:
 *   npm run restore:courses                 dry run — prints what it would write
 *   npm run restore:courses -- --apply      recreate the course documents
 *
 * WHAT THIS CAN AND CANNOT BRING BACK
 *
 * It recreates the four course documents at their ORIGINAL _ids, which is the
 * part that matters most: the 14 surviving CourseAccess grants still point at
 * those ids, so every student who had access gets it back automatically the
 * moment the courses exist again.
 *
 * It CANNOT bring back lessons. A Lesson requires `driveFileId` — the private
 * Google Drive file id — and those ids existed only in the deleted documents.
 * They are not recoverable from Drive either: these courses were built through
 * the admin dashboard's "Add Drive lesson" form rather than `drive:import`, so
 * their `driveFolderId` was never recorded, and a service account cannot
 * enumerate files it has not been given a folder id for.
 *
 * Lesson titles/orders/durations for "Introduction of SQL" are included below
 * (recovered from an API response captured before the wipe) purely as a
 * reference list for whoever re-adds them.
 *
 * So: restore the courses with this, then either
 *   (a) restore the database from an Atlas backup — the only complete fix, and
 *       the only way to get student progress back; or
 *   (b) re-add each lesson's Drive link through the admin dashboard, or share
 *       the course folders with the service account and use
 *       `npm run drive:import -- --apply`.
 */
require('dotenv').config();

const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const CourseAccess = require('../models/CourseAccess');

const APPLY = process.argv.slice(2).includes('--apply');

/**
 * The four courses, reconstructed from API responses captured before the
 * wipe. `_id` is the critical field — it is what reattaches the access
 * grants. Fields that were genuinely empty before are left empty rather than
 * invented.
 */
const COURSES = [
  {
    _id: '6a97fb1d1e9aa1dabe849b02',
    title: 'Introduction of Python',
    slug: 'introduction-to-mentor-data-analytics-using-python',
    description: 'Introduction to Mentor & \nData Analytics Using Python - First Session',
    instructor: '',
    level: 'Beginner',
    accent: 'sky',
    hasDriveVideos: true,
    lessonsBefore: 12,
  },
  {
    _id: '6a99043f57f970e4921e8293',
    title: 'Introduction of SQL',
    slug: 'introduction-of-sql',
    description: '',
    instructor: 'Vasanth Kumar',
    level: 'Beginner',
    accent: 'sky',
    hasDriveVideos: true,
    lessonsBefore: 13,
  },
  {
    _id: '6a99081757f970e4921e8318',
    title: 'Introduction of PowerBi',
    slug: 'introduction-of-powerbi',
    description: '',
    instructor: 'Vasanth Kumar',
    level: 'Beginner',
    accent: 'violet',
    hasDriveVideos: true,
    lessonsBefore: 11,
  },
  {
    _id: '6a9aa8a15c02ba1dfbafc043',
    title: 'Workshops/Placements Activities',
    slug: 'workshops-placements-activities',
    description: '',
    instructor: 'Vasanth Kumar',
    level: 'Beginner',
    accent: 'emerald',
    hasDriveVideos: true,
    lessonsBefore: 22,
  },
];

/**
 * Reference only — the SQL course's lesson list as it was, for re-entry.
 * Nothing here can be written without each lesson's Drive file id.
 */
const SQL_LESSONS = [
  'SQL Introduction',
  'Installation DDL, DML',
  'Select(DQL),Where, Filter, order of execution,Aggregate function, Groupby,orderby',
  'Having,Subqueries,correlated subquery',
  'Operator(And ,Not,Or),Date functions,set operators',
  'Constraints,relationships,order of insertion,order of deletion,Joins',
  'Explained Insurance basics,Joins',
  'Windows Function,Percentage of contribution,MOM,Running Total',
  'Advanced SQL Interview Preparation: Data Deduplication, Joins, Views & Advanced Functions',
  'SQL Design Masterclass: ACID Properties, Normalization, Indexing & ER Diagrams',
  'Functions and Stored Procedures in MySQL – Concepts, Implementation, and Use Cases',
  'Nishanth SQL Workshop   -   End to End Revision Part-1',
  'Nishanth SQL Workshop -  End to End Revision Part-2',
];

async function main() {
  await connectDB();

  // Access grants survived the wipe, so they tell us who is waiting on what.
  const grants = await CourseAccess.find({ active: true }).lean();
  const grantsByCourse = new Map();
  for (const grant of grants) {
    const key = String(grant.courseId);
    grantsByCourse.set(key, (grantsByCourse.get(key) || 0) + 1);
  }

  console.log(`\n  ${APPLY ? 'Restoring' : 'Dry run —'} course documents\n`);

  let created = 0;
  let already = 0;

  for (const spec of COURSES) {
    const existing = await Course.findById(spec._id);
    const waiting = grantsByCourse.get(spec._id) || 0;

    if (existing) {
      already += 1;
      console.log(`  = ${spec.title}  (already present)`);
      continue;
    }

    console.log(`  + ${spec.title}`);
    console.log(`      _id          ${spec._id}`);
    console.log(`      slug         ${spec.slug}`);
    console.log(`      lessons lost ${spec.lessonsBefore} (must be re-added with Drive links)`);
    console.log(`      students     ${waiting} access grant(s) reattach to this id`);

    if (APPLY) {
      const { lessonsBefore, ...fields } = spec;
      await Course.create({
        ...fields,
        _id: new mongoose.Types.ObjectId(spec._id),
        lessons: [], // nothing to point at until lessons are re-added
      });
      created += 1;
    }
  }

  const lessonCount = await Lesson.countDocuments();

  console.log('');
  if (!APPLY) {
    console.log('  Nothing was written. Re-run with --apply to create the courses:');
    console.log('    npm run restore:courses -- --apply\n');
  } else {
    console.log(`  Done: ${created} course(s) created, ${already} already present.`);
    console.log(`  Lessons in the database: ${lessonCount} — re-add them per course.\n`);
  }

  console.log('  "Introduction of SQL" lesson list, for re-entry:');
  SQL_LESSONS.forEach((title, i) => console.log(`    ${String(i + 1).padStart(2, '0')}. ${title}`));
  console.log('');

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('\n[restore:courses] failed:', err.message, '\n');
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
