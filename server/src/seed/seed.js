/**
 * Seed script: npm run seed
 *
 *   npm run seed                 refuses to run if the database has content
 *   npm run seed -- --force      wipe courses/lessons/progress first, then seed
 *
 * Creates the demo courses + lessons for an EMPTY database.
 *
 * SAFETY (added after this script destroyed a live catalogue):
 * it used to begin with an unconditional deleteMany() on courses, lessons and
 * progress, so running it against a populated database deleted real courses
 * and every student's watch history with no confirmation and no backup. It now
 * refuses to touch a database that already holds data unless `--force` is
 * passed explicitly, and it prints what it would destroy before doing it.
 *
 * The placeholder driveFileId values below are not real Drive ids, so seeded
 * lessons will not play until they are linked with `npm run drive:link` or
 * replaced through the admin dashboard.
 */
require('dotenv').config();

const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Progress = require('../models/Progress');

const courses = [
  {
    course: {
      title: 'React.js Masterclass',
      slug: 'react',
      description: 'Learn React from beginner to advanced — components, state, hooks and patterns.',
      instructor: 'Vasanth Kumar',
      level: 'Beginner',
      hours: 8,
      accent: 'sky',
      category: 'Web Development',
      instructorTitle: 'Senior Frontend Engineer',
      rating: 4.8,
      ratingCount: 126,
      studentsCount: 1840,
      price: 0,
      outcomes: [
        'Build production React applications from scratch',
        'Think in components and compose reusable UI',
        'Manage state confidently with hooks',
        'Structure a project that stays maintainable as it grows',
      ],
      requirements: [
        'Comfortable with HTML, CSS and modern JavaScript',
        'Node.js installed locally',
      ],
      hasDriveVideos: true,
    },
    lessons: [
      {
        title: 'Introduction to React',
        description: 'What React is, why it exists, and how the component model changes UI work.',
        // TODO: replace with your real Google Drive file id
        driveFileId: 'REPLACE_WITH_DRIVE_FILE_ID_1',
        order: 1,
        duration: 420,
      },
      {
        title: 'Project Setup',
        description: 'Scaffolding a React project with Vite, Tailwind CSS and the folder structure we use.',
        driveFileId: 'REPLACE_WITH_DRIVE_FILE_ID_2',
        order: 2,
        duration: 540,
      },
      {
        title: 'React Components',
        description: 'Introduction to React components and building reusable UI.',
        driveFileId: 'REPLACE_WITH_DRIVE_FILE_ID_3',
        order: 3,
        duration: 600,
      },
      {
        title: 'Props and State',
        description: 'Passing data down with props and holding local state with useState.',
        driveFileId: 'REPLACE_WITH_DRIVE_FILE_ID_4',
        order: 4,
        duration: 660,
      },
      {
        title: 'React Hooks',
        description: 'useEffect, useMemo and writing your own custom hooks.',
        driveFileId: 'REPLACE_WITH_DRIVE_FILE_ID_5',
        order: 5,
        duration: 720,
      },
    ],
  },
  {
    course: {
      title: 'Node.js & Express API',
      slug: 'node',
      description: 'Build REST APIs with Node.js, Express and MongoDB.',
      instructor: 'Vasanth Kumar',
      level: 'Intermediate',
      hours: 6,
      accent: 'emerald',
      category: 'Backend Development',
      instructorTitle: 'Senior Frontend Engineer',
      rating: 4.7,
      ratingCount: 84,
      studentsCount: 1120,
      price: 0,
      outcomes: [
        'Design and build REST APIs with Express',
        'Model data properly with Mongoose',
        'Handle errors, validation and middleware cleanly',
      ],
      requirements: ['Basic JavaScript', 'Familiarity with the terminal'],
      hasDriveVideos: false,
    },
    lessons: [
      {
        title: 'Introduction to Node.js',
        description: 'The event loop, modules and how Node handles I/O.',
        driveFileId: 'REPLACE_WITH_DRIVE_FILE_ID_NODE_1',
        order: 1,
        duration: 480,
      },
      {
        title: 'Express Routing',
        description: 'Routers, middleware and structuring an Express application.',
        driveFileId: 'REPLACE_WITH_DRIVE_FILE_ID_NODE_2',
        order: 2,
        duration: 520,
      },
    ],
  },
  {
    course: {
      title: 'MongoDB Essentials',
      slug: 'mongodb',
      description: 'Document modelling, queries and aggregation with Mongoose.',
      instructor: 'Vasanth Kumar',
      level: 'Beginner',
      hours: 4,
      accent: 'violet',
      category: 'Data & Databases',
      instructorTitle: 'Senior Frontend Engineer',
      rating: 4.6,
      ratingCount: 51,
      studentsCount: 760,
      price: 0,
      outcomes: [
        'Model documents for real applications',
        'Write queries and aggregation pipelines',
        'Know when to embed and when to reference',
      ],
      requirements: ['No prior database experience needed'],
      hasDriveVideos: false,
    },
    lessons: [
      {
        title: 'Documents and Collections',
        description: 'How MongoDB stores data and when to embed vs reference.',
        driveFileId: 'REPLACE_WITH_DRIVE_FILE_ID_MONGO_1',
        order: 1,
        duration: 360,
      },
    ],
  },
];

const FORCE = process.argv.slice(2).includes('--force');

async function seed() {
  await connectDB();

  const [courseCount, lessonCount, progressCount] = await Promise.all([
    Course.countDocuments(),
    Lesson.countDocuments(),
    Progress.countDocuments(),
  ]);
  const existing = courseCount + lessonCount + progressCount;

  // Refuse to destroy a populated database by accident. Seeding is only ever
  // meant for an empty one, and the cost of being wrong here is a catalogue
  // and every student's watch history.
  if (existing > 0 && !FORCE) {
    const titles = await Course.find().select('title').lean();

    console.error('\n  ✗ Refusing to seed: this database already has content.\n');
    console.error(`    courses  : ${courseCount}`);
    console.error(`    lessons  : ${lessonCount}`);
    console.error(`    progress : ${progressCount}  (student watch history)\n`);
    if (titles.length) {
      console.error('    Existing courses that would be DELETED:');
      titles.forEach((c) => console.error(`      • ${c.title}`));
      console.error('');
    }
    console.error('    Seeding is only for an empty database. If you really want to');
    console.error('    replace everything above, back it up first and then run:\n');
    console.error('      npm run seed -- --force\n');

    await mongoose.disconnect();
    process.exitCode = 1;
    return;
  }

  if (existing > 0) {
    console.log(
      `[seed] --force: deleting ${courseCount} course(s), ${lessonCount} lesson(s), ` +
        `${progressCount} progress record(s)`
    );
    await Promise.all([Course.deleteMany({}), Lesson.deleteMany({}), Progress.deleteMany({})]);
    console.log('[seed] cleared courses, lessons and progress');
  }

  for (const entry of courses) {
    const course = await Course.create(entry.course);
    const lessons = await Lesson.insertMany(
      entry.lessons.map((lesson) => ({ ...lesson, courseId: course._id }))
    );
    // The Course.lessons array is what the catalogue counts from, so it has
    // to be populated too — the original script left it empty.
    course.lessons = lessons.map((l) => l._id);
    await course.save();

    console.log(`[seed] ${course.title} — ${lessons.length} lessons`);
    lessons.forEach((l) => console.log(`         ${l.order}. ${l.title}  (_id ${l._id})`));
  }

  console.log('\n[seed] done. The seeded lessons carry placeholder Drive ids and will not');
  console.log('[seed] play until you link them:  npm run drive:link -- --apply\n');

  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error('[seed] failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
