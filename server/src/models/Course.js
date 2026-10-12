const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, default: '' },
    lessons: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }],
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

    // --- admin-managed Browse Courses content -----------------------------
    // `summary` is the one-or-two line pitch used on cards and in the
    // package header; `descriptionHtml` is the admin's formatted long copy
    // (bold / italic / font family / font size), sanitised on write by
    // utils/sanitizeHtml and again in the browser before it is rendered.
    summary: { type: String, default: '' },
    descriptionHtml: { type: String, default: '' },

    // A public, shareable preview reel — unlike lesson videos this one is
    // meant to be seen before enrolling, so a plain URL is fine here.
    introVideoUrl: { type: String, default: '' },

    // --- package / pricing details shown on the course details page -------
    features: { type: [String], default: [] }, // what the package includes
    originalPrice: { type: Number, default: 0 }, // struck through when > price
    language: { type: String, default: '' },
    certificateIncluded: { type: Boolean, default: true },

    // Unpublished courses stay out of the student-facing catalogue but
    // remain visible and editable in the admin dashboard.
    published: { type: Boolean, default: true },

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
