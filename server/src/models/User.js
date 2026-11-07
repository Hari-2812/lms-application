const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Staff permissions within the admin panel. Every staff account has
 * role 'admin' (so the many `role: { $ne: 'admin' }` learner queries keep
 * working); `adminRole` narrows what it may do. Accounts created before the
 * field existed have no value and are treated as super admins.
 */
const ADMIN_ROLES = ['super_admin', 'support'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['student', 'admin'], default: 'student' },
    adminRole: { type: String, enum: ADMIN_ROLES },

    // --- profile / contact -------------------------------------------------
    phone: { type: String, default: '', trim: true },
    city: { type: String, default: '', trim: true },
    headline: { type: String, default: '', trim: true },
    bio: { type: String, default: '', trim: true },

    // --- account state -----------------------------------------------------
    // A suspended account cannot sign in, and any token it still holds stops
    // working on the next request.
    status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
    suspendedAt: { type: Date },
    suspendedReason: { type: String, default: '' },
    lastLoginAt: { type: Date },

    // --- course access -------------------------------------------------------
    // Full Access: every course and every study material, including courses
    // added later. Individually granted or paid courses (CourseAccess rows)
    // are kept separately, so switching this off never takes those away.
    fullAccess: { type: Boolean, default: false, index: true },
    fullAccessGrantedAt: { type: Date },
    fullAccessGrantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // --- security ----------------------------------------------------------
    // Tokens issued before this moment are rejected, so changing or resetting
    // a password signs out every other session.
    passwordChangedAt: { type: Date },
    resetPasswordTokenHash: { type: String },
    resetPasswordExpires: { type: Date },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    // Skipped for brand-new accounts: their first token is issued in the same
    // second, and a JWT `iat` has one-second resolution.
    if (!this.isNew) this.passwordChangedAt = new Date();
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

/** The effective staff role, or null for learners. */
userSchema.methods.staffRole = function staffRole() {
  if (this.role !== 'admin') return null;
  return this.adminRole || 'super_admin';
};

// Exclude password and security bookkeeping from JSON output
userSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.password;
    delete ret.__v;
    delete ret.resetPasswordTokenHash;
    delete ret.resetPasswordExpires;
    delete ret.failedLoginAttempts;
    delete ret.lockUntil;
    delete ret.passwordChangedAt;
    if (ret.role === 'admin') ret.adminRole = ret.adminRole || 'super_admin';
    // Map _id to id to match the expected frontend shape for 'student'
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

const User = mongoose.model('User', userSchema);
User.ADMIN_ROLES = ADMIN_ROLES;

module.exports = User;
