/**
 * Backfill script: npm run backfill
 *
 * Adds the catalogue metadata (category, rating, students, price, outcomes,
 * requirements) to courses that were created before those fields existed.
 *
 * Unlike `npm run seed` this is NON-DESTRUCTIVE: it never touches lessons or
 * progress, and it only writes fields that are currently empty, so anything
 * you have already edited is left alone.
 */
require('dotenv').config();

const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const Course = require('../models/Course');

/** Keyed by course slug. */
const metadata = {
  react: {
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
  },
  node: {
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
  },
  mongodb: {
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
  },
};

/** True when the stored value is still the schema default. */
const isEmpty = (value) =>
  value === undefined || value === null || value === '' || value === 0 ||
  (Array.isArray(value) && value.length === 0);

async function backfill() {
  await connectDB();

  const courses = await Course.find();
  let updated = 0;

  for (const course of courses) {
    const patch = metadata[course.slug];
    if (!patch) {
      console.log(`[backfill] skipped "${course.title}" — no metadata for slug "${course.slug}"`);
      continue;
    }

    const applied = [];
    for (const [key, value] of Object.entries(patch)) {
      if (isEmpty(course[key])) {
        course[key] = value;
        applied.push(key);
      }
    }

    if (applied.length === 0) {
      console.log(`[backfill] "${course.title}" already populated`);
      continue;
    }

    await course.save();
    updated += 1;
    console.log(`[backfill] "${course.title}" — set ${applied.join(', ')}`);
  }

  console.log(`\n[backfill] done. ${updated} of ${courses.length} courses updated.`);
  console.log('[backfill] lessons and progress were not modified.\n');

  await mongoose.disconnect();
}

backfill().catch(async (err) => {
  console.error('[backfill] failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
