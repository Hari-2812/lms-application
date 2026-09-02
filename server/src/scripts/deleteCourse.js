require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');

async function removeLmsCourse() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB...');

    // Find the course by title (case-insensitive) or slug
    const course = await Course.findOne({ 
      $or: [
        { title: { $regex: /^lms$/i } },
        { slug: 'lms' }
      ]
    });

    if (!course) {
      console.log('Course "lms" not found.');
      process.exit(0);
    }

    console.log(`Found course: ${course.title} (${course._id})`);

    // Delete associated lessons
    const deletedLessons = await Lesson.deleteMany({ courseId: course._id });
    console.log(`Deleted ${deletedLessons.deletedCount} associated lessons.`);

    // Delete the course
    await Course.findByIdAndDelete(course._id);
    console.log('Course deleted successfully.');

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

removeLmsCourse();
