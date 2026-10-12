require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');

const { connectDB } = require('./config/db');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const driveService = require('./services/googleDriveService');
const { initSocket } = require('./services/socketService');
const { UPLOAD_ROOT } = require('./middleware/upload');
const routes = require('./routes');

const PORT = process.env.PORT || 5000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const ALLOWED_ORIGINS = (process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .map((origin) => origin.replace(/\/$/, ''))
  .filter(Boolean);

const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return !IS_PRODUCTION && LOCALHOST_ORIGIN.test(origin);
}

const app = express();

app.use(
  cors({
    origin: (origin, callback) => callback(null, isOriginAllowed(origin)),
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
  })
);
app.use(express.json());

/**
 * Admin-uploaded course thumbnails.
 *
 * Read-only and public: a thumbnail appears on the public catalogue, so it
 * has to be fetchable without a token. Only raster image types can ever be
 * written here (see middleware/upload.js), and `nosniff` stops a browser
 * from reinterpreting one as HTML or script.
 */
app.use(
  '/uploads',
  express.static(UPLOAD_ROOT, {
    index: false, // no directory listings
    dotfiles: 'deny',
    maxAge: '7d',
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      // Belt and braces: even if something non-image lands here, this makes
      // the browser download it rather than execute it in our origin.
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'");
    },
  })
);

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
