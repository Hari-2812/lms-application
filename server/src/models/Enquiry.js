const mongoose = require('mongoose');

/**
 * A response to the homepage "Enroll Now" form.
 *
 * Saved here first, so nothing is lost if Google is unreachable, and then
 * copied to the Google Sheet configured in Settings → Google Sheet.
 * `sheetStatus` records how that copy went so a failed one can be retried
 * from Admin → Enquiries.
 */
const SHEET_STATUSES = ['pending', 'synced', 'failed', 'skipped'];

/** "Status" on the form: where the visitor is in their career. */
const CAREER_STATUSES = ['Student', 'Fresher / job seeker', 'Working professional', 'Career break', 'Business owner / freelancer'];

const enquirySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    program: { type: String, default: '', trim: true },
    // "Location" on the form.
    city: { type: String, default: '', trim: true },
    // "Brief profile summary" on the form.
    message: { type: String, default: '', trim: true },
    careerStatus: { type: String, default: '', trim: true },
    designation: { type: String, default: '', trim: true },
    alternatePhone: { type: String, default: '', trim: true },
    source: { type: String, default: 'homepage' },
    // Set when the visitor was signed in.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    sheetStatus: { type: String, enum: SHEET_STATUSES, default: 'pending', index: true },
    sheetError: { type: String, default: '' },
    sheetSyncedAt: { type: Date },
  },
  { timestamps: true }
);

enquirySchema.index({ createdAt: -1 });

enquirySchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

const Enquiry = mongoose.model('Enquiry', enquirySchema);
Enquiry.SHEET_STATUSES = SHEET_STATUSES;
Enquiry.CAREER_STATUSES = CAREER_STATUSES;

module.exports = Enquiry;
