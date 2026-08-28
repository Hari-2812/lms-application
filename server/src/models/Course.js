const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, default: '' },
    instructor: { type: String, default: 'Demo Instructor' },
    level: { type: String, default: 'Beginner' },
    hours: { type: Number, default: 0 },
    thumbnail: { type: String, default: '' },
    accent: { type: String, default: 'sky' },

    // --- catalogue metadata used by the course cards / details page ---
    // All optional with defaults so existing documents keep working; the UI
    // hides any field that is missing rather than inventing a value.
    category: { type: String, default: '' },
    instructorTitle: { type: String, default: '' },
    rating: { type: Number, default: 0 }, // 0 = "not rated yet", hidden in the UI
    ratingCount: { type: Number, default: 0 },
    studentsCount: { type: Number, default: 0 },
    price: { type: Number, default: 0 }, // 0 renders as "Free"
    outcomes: { type: [String], default: [] }, // "What you'll learn" bullets
    requirements: { type: [String], default: [] },

    // Marks the course that is wired to real private Google Drive files.
    hasDriveVideos: { type: Boolean, default: false },

    // Set when the course was generated from a Drive folder by
    // `npm run drive:import`. Lets a re-run update the same course instead of
    // creating a duplicate, and distinguishes imported courses from seeded ones.
    driveFolderId: { type: String, default: '', index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Course', courseSchema);
