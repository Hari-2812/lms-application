const mongoose = require('mongoose');

/**
 * Platform-wide settings, stored as a single document (key 'platform').
 * Read through services/settingsService, which caches it and fills in
 * defaults for anything a stored document predates.
 */
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, minimize: false }
);

module.exports = mongoose.model('Setting', settingSchema);
