/**
 * Seed script: npm run seed
 *
 * Creates the demo courses + lessons. Replace the placeholder videoFileId
 * values below (or edit them in MongoDB afterwards) with the file ids from
 * your private Google Drive folder, then re-run.
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
        videoFileId: 'REPLACE_WITH_DRIVE_FILE_ID_1',
        order: 1,
        duration: 420,
      },
      {
        title: 'Project Setup',
        description: 'Scaffolding a React project with Vite, Tailwind CSS and the folder structure we use.',
        videoFileId: 'REPLACE_WITH_DRIVE_FILE_ID_2',
        order: 2,
        duration: 540,
      },
      {
        title: 'React Components',
        description: 'Introduction to React components and building reusable UI.',
        videoFileId: 'REPLACE_WITH_DRIVE_FILE_ID_3',
        order: 3,
        duration: 600,
      },
      {
        title: 'Props and State',
        description: 'Passing data down with props and holding local state with useState.',
        videoFileId: 'REPLACE_WITH_DRIVE_FILE_ID_4',
        order: 4,
        duration: 660,
      },
      {
        title: 'React Hooks',
        description: 'useEffect, useMemo and writing your own custom hooks.',
        videoFileId: 'REPLACE_WITH_DRIVE_FILE_ID_5',
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
        videoFileId: 'REPLACE_WITH_DRIVE_FILE_ID_NODE_1',
        order: 1,
        duration: 480,
      },
      {
        title: 'Express Routing',
        description: 'Routers, middleware and structuring an Express application.',
        videoFileId: 'REPLACE_WITH_DRIVE_FILE_ID_NODE_2',
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
        videoFileId: 'REPLACE_WITH_DRIVE_FILE_ID_MONGO_1',
        order: 1,
        duration: 360,
      },
    ],
  },
];

async function seed() {
  await connectDB();

  await Promise.all([Course.deleteMany({}), Lesson.deleteMany({}), Progress.deleteMany({})]);
  console.log('[seed] cleared courses, lessons and progress');

  for (const entry of courses) {
    const course = await Course.create(entry.course);
    const lessons = await Lesson.insertMany(
      entry.lessons.map((lesson) => ({ ...lesson, courseId: course._id }))
    );
    console.log(`[seed] ${course.title} — ${lessons.length} lessons`);
    lessons.forEach((l) => console.log(`         ${l.order}. ${l.title}  (_id ${l._id})`));
  }

  console.log('\n[seed] done. Replace the REPLACE_WITH_DRIVE_FILE_ID_* values with real');
  console.log('[seed] Google Drive file ids in src/seed/seed.js, then run npm run seed again.\n');

  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error('[seed] failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
