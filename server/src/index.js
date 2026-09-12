require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');

const { connectDB } = require('./config/db');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const driveService = require('./services/googleDriveService');
const { initSocket } = require('./services/socketService');
const routes = require('./routes');

const PORT = process.env.PORT || 5000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * CORS allowlist.
 *
 * CLIENT_URL is an optional comma-separated list of exact origins, e.g.
 *   CLIENT_URL=https://app.example.com,https://admin.example.com
 *
 * In development we additionally accept any localhost port, because Vite
 * moves to 5174/5175/... whenever 5173 is already taken. Pinning a single
 * port there just breaks the moment a previous dev server is still running.
 */
const ALLOWED_ORIGINS = (process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .map((origin) => origin.replace(/\/$/, ''))
  .filter(Boolean);

const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function isOriginAllowed(origin) {
  // No Origin header: same-origin fetches, the Vite proxy, curl, native apps.
  // These are not browser cross-origin requests, so there is nothing to police.
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return !IS_PRODUCTION && LOCALHOST_ORIGIN.test(origin);
}

const app = express();

app.use(
  cors({
    // `false` simply omits the header, so the browser blocks it — cleaner than
    // throwing, which would surface as a 500 instead of a CORS error.
    origin: (origin, callback) => callback(null, isOriginAllowed(origin)),
    // The browser needs these to seek an HTML5 video across origins.
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
  })
);
app.use(express.json());

app.use('/api', routes);
app.use(notFoundHandler);
app.use(errorHandler);

const httpServer = http.createServer(app);
initSocket(httpServer, isOriginAllowed);

async function start() {
  try {
    await connectDB();
  } catch (err) {
    console.error('[db] connection failed:', err.message);
    console.error('[db] is MongoDB running? Try: net start MongoDB');
    process.exit(1);
  }

  httpServer.listen(PORT, () => {
    const drive = driveService.getConfigSummary();

    const corsSummary = [
      ...ALLOWED_ORIGINS,
      IS_PRODUCTION ? null : 'http://localhost:* (development)',
    ]
      .filter(Boolean)
      .join(', ');

    console.log(`\n  LMS demo API   http://localhost:${PORT}`);
    console.log(`  CORS allows    ${corsSummary || 'nothing — set CLIENT_URL'}`);

    if (IS_PRODUCTION && ALLOWED_ORIGINS.length === 0) {
      console.warn('  ⚠ NODE_ENV=production but CLIENT_URL is unset — browsers will be blocked.');
    }

    if (!drive.configured) {
      console.log('  Video source   local demo-media/ fallback — Drive not configured');
      console.log('                 run `npm run drive:check` to set it up\n');
      return;
    }

    console.log('  Video source   private Google Drive (service account)');
    console.log(`  Service acct   ${drive.clientEmail}`);
    console.log(`  Drive folder   ${drive.folderId || 'NOT SET — run `npm run drive:check`'}\n`);
  });
}

start();
