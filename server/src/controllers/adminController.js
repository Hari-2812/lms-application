const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const driveService = require('../services/googleDriveService');

async function createCourse(req, res, next) {
  try {
    const { title, slug, description, instructor, level } = req.body;
    
    // Check if course with slug already exists
    const existingCourse = await Course.findOne({ slug });
    if (existingCourse) {
      return res.status(400).json({ error: 'Course with this slug already exists' });
    }

    const course = new Course({
      title,
      slug,
      description,
      instructor,
      level,
      hasDriveVideos: true // Assuming manually added courses have drive videos
    });

    await course.save();
    res.status(201).json(course);
  } catch (err) {
    next(err);
  }
}

async function addLesson(req, res, next) {
  try {
    const { courseId, title, description, date, driveLink } = req.body;

    if (!courseId || !title || !driveLink) {
      return res.status(400).json({ error: 'courseId, title, and driveLink are required' });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Extract driveFileId from the link using the service
    // normaliseFolderId works for file IDs too
    const driveFileId = driveService.normaliseFolderId(driveLink);
    if (!driveFileId) {
      return res.status(400).json({ error: 'Invalid Google Drive link' });
    }

    // Check if lesson already exists to prevent duplicates
    const existingLesson = await Lesson.findOne({ courseId, driveFileId });
    if (existingLesson) {
      return res.status(400).json({ error: 'Lesson with this Drive video already exists in the course' });
    }

    // Fetch metadata from Google Drive
    let driveMetadata;
    try {
      driveMetadata = await driveService.getVideoMetadata(driveFileId);
    } catch (err) {
      console.error('[admin] Failed to fetch drive metadata:', err.message);
      
      const errorMessage = err.status === 404 
        ? 'Drive file was not found, or is not shared with the service account.'
        : err.status === 403
        ? 'Google refused access to this file. Check that the Drive API is enabled.'
        : err.message || 'Could not fetch Drive metadata. Ensure the file is shared with the service account.';
        
      return res.status(400).json({ error: errorMessage });
    }

    // Get the next order number
    const lastLesson = await Lesson.findOne({ courseId }).sort('-order');
    const order = lastLesson ? lastLesson.order + 1 : 1;

    const lesson = new Lesson({
      courseId,
      title,
      description,
      date,
      order,
      driveFileId,
      driveFileName: driveMetadata.name,
      driveWebViewLink: driveMetadata.webViewLink,
      mimeType: driveMetadata.mimeType,
      duration: driveMetadata.durationSeconds,
      folderId: driveMetadata.folderId,
      folderName: driveMetadata.folderName
    });

    await lesson.save();

    // Update course to include this lesson in the array
    course.lessons.push(lesson._id);
    await course.save();

    res.status(201).json(lesson);
  } catch (err) {
    next(err);
  }
}

async function deleteCourse(req, res, next) {
  try {
    const { id } = req.params;
    
    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Delete associated lessons
    await Lesson.deleteMany({ courseId: id });
    
    // Delete the course
    await Course.findByIdAndDelete(id);
    
    res.json({ success: true, message: 'Course deleted successfully' });
  } catch (err) {
    next(err);
  }
}

async function deleteLesson(req, res, next) {
  try {
    const { id } = req.params;
    
    const lesson = await Lesson.findById(id);
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    // Remove lesson ID from course.lessons array
    await Course.findByIdAndUpdate(lesson.courseId, {
      $pull: { lessons: id }
    });

    // Delete the lesson
    await Lesson.findByIdAndDelete(id);
    
    res.json({ success: true, message: 'Lesson deleted successfully' });
  } catch (err) {
    next(err);
  }
}

async function updateCourse(req, res, next) {
  try {
    const { id } = req.params;
    const { title, slug, description, instructor, level } = req.body;
    
    const course = await Course.findByIdAndUpdate(
      id,
      { title, slug, description, instructor, level },
      { new: true }
    );
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    res.json(course);
  } catch (err) {
    next(err);
  }
}

async function updateLesson(req, res, next) {
  try {
    const { id } = req.params;
    const { title, description, date } = req.body;
    
    const lesson = await Lesson.findByIdAndUpdate(
      id,
      { title, description, date },
      { new: true }
    );
    
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }
    
    res.json(lesson);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createCourse,
  addLesson,
  deleteCourse,
  deleteLesson,
  updateCourse,
  updateLesson,
};
