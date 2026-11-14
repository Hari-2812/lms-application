const mongoose = require('mongoose');

/**
 * One learner's progress through one lesson video.
 *
 * `watchedRanges` are the parts of the video actually played (merged
 * [start, end] spans in seconds), so skipping ahead never counts as watching.
 * `percent` is the share of the video those spans cover, and the lesson is
 * `completed` once that reaches Settings → Learning rules → lessonCompletePercent.
 * `position` is only where playback last was — the resume point.
 */
const watchedRangeSchema = new mongoose.Schema(
  {
    start: { type: Number, required: true },
    end: { type: Number, required: true },
  },
  { _id: false }
);

const progressSchema = new mongoose.Schema(
  {
    studentId: { type: String, required: true, index: true },
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    position: { type: Number, default: 0 }, // last playback position in seconds (resume point)
    duration: { type: Number, default: 0 },
    percent: { type: Number, default: 0 }, // share of the video actually watched
    watchedSeconds: { type: Number, default: 0 },
    // Absent on rows saved before watch tracking; see lessonProgressService.
    watchedRanges: { type: [watchedRangeSchema], default: undefined },
    completed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

progressSchema.index({ studentId: 1, lessonId: 1 }, { unique: true });

module.exports = mongoose.model('Progress', progressSchema);
