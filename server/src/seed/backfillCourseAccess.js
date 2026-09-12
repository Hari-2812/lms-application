/**
 * Backfill script: npm run backfill:access
 *
 * Grants every existing student access to every existing course, by creating
 * an active CourseAccess row for each (student, course) pair that doesn't
 * already have one. Run this once when introducing per-student course
 * access control, so nothing that currently works breaks on deploy — admins
 * take over granting/revoking access from that point forward.
 */
require('dotenv').config();

const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const User = require('../models/User');
const Course = require('../models/Course');
const CourseAccess = require('../models/CourseAccess');

async function backfill() {
  await connectDB();

  const [students, courses] = await Promise.all([User.find(), Course.find()]);

  let created = 0;
  let skipped = 0;

  for (const student of students) {
    for (const course of courses) {
      const result = await CourseAccess.updateOne(
        { studentId: student._id, courseId: course._id },
        { $setOnInsert: { studentId: student._id, courseId: course._id, active: true } },
        { upsert: true }
      );
      if (result.upsertedCount) created += 1;
      else skipped += 1;
    }
  }

  console.log(
    `\n[backfill:access] done. ${created} grant(s) created, ${skipped} already existed ` +
      `(${students.length} student(s) x ${courses.length} course(s)).\n`
  );

  await mongoose.disconnect();
}

backfill().catch(async (err) => {
  console.error('[backfill:access] failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
