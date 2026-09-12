/**
 * One-off migration: npm run promote:admin
 *
 * Sets role: 'admin' on the account that requireAdmin used to recognise by
 * hardcoded email, now that admin access is a real role on User. Safe to
 * re-run; it's a no-op if the account is already an admin or doesn't exist
 * (register it via /api/auth/register first).
 */
require('dotenv').config();

const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const User = require('../models/User');
const { ADMIN_EMAIL } = require('../middleware/authMiddleware');

async function promote() {
  await connectDB();

  const user = await User.findOne({ email: ADMIN_EMAIL });
  if (!user) {
    console.log(`[promote:admin] no account found for ${ADMIN_EMAIL} — register it first.`);
  } else if (user.role === 'admin') {
    console.log(`[promote:admin] ${ADMIN_EMAIL} is already an admin.`);
  } else {
    user.role = 'admin';
    await user.save();
    console.log(`[promote:admin] ${ADMIN_EMAIL} promoted to admin.`);
  }

  await mongoose.disconnect();
}

promote().catch(async (err) => {
  console.error('[promote:admin] failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
