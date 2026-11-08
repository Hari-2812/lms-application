
const fs = require('fs');
const path = require('path');
const Lesson = require('../models/Lesson');
const driveService = require('./googleDriveService');

const DEMO_MEDIA_DIR = path.join(__dirname, '..', '..', 'demo-media');

function notFound(message) {
  const err = new Error(message);
  err.status = 404;
  return err;
}

/** Parse "bytes=start-end" against a known total size. */
function parseRange(rangeHeader, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec((rangeHeader || '').trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  let start;
  let end;

  if (rawStart === '') {
    // Suffix range: "bytes=-500" means the last 500 bytes.
    const suffix = Number(rawEnd);
    if (!suffix) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1);
  }

  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) return null;
  return { start, end };
}

/** Resolve the local demo file for a lesson, if one exists. */
function resolveLocalMedia(lesson) {
  const candidates = [`${lesson.driveFileId}.mp4`, 'sample.mp4'];
  for (const name of candidates) {
    const filePath = path.join(DEMO_MEDIA_DIR, name);
    if (fs.existsSync(filePath)) return filePath;
  }
  return null;
}

/**
 * Lessons seeded before the Drive folder was wired up still carry the
 * REPLACE_WITH_DRIVE_FILE_ID_* placeholders. Those are not real ids, so there
 * is no point asking Google about them.
 */
function isPlaceholderFileId(fileId) {
  return /^REPLACE_WITH/i.test(fileId || '');
}

function streamFromLocalFile(filePath, rangeHeader) {
  const size = fs.statSync(filePath).size;
  const range = rangeHeader ? parseRange(rangeHeader, size) : null;

  if (!range) {
    return {
      status: 200,
      contentType: 'video/mp4',
      contentLength: size,
      contentRange: null,
      stream: fs.createReadStream(filePath),
      source: 'local-demo-media',
    };
  }

  return {
    status: 206,
    contentType: 'video/mp4',
    contentLength: range.end - range.start + 1,
    contentRange: `bytes ${range.start}-${range.end}/${size}`,
    stream: fs.createReadStream(filePath, { start: range.start, end: range.end }),
    source: 'local-demo-media',
  };
}

/**
 * The single entry point used by the video controller.
 * @param {string} lessonId
 * @param {string|undefined} rangeHeader raw `req.headers.range`
 */
async function getLessonVideoStream(lessonId, rangeHeader) {
  const lesson = await Lesson.findById(lessonId).select('+driveFileId');
  if (!lesson) throw notFound('Lesson not found');
  if (!lesson.driveFileId) throw notFound('Lesson has no video attached');

  const useDrive = driveService.isConfigured() && !isPlaceholderFileId(lesson.driveFileId);

  // ---- Fallback: no usable Drive file -> stream a local demo file --------
  if (!useDrive) {
    const localFile = resolveLocalMedia(lesson);
    if (localFile) return streamFromLocalFile(localFile, rangeHeader);

    const err = new Error(
      driveService.isConfigured()
        ? `Lesson "${lesson.title}" still has a placeholder video id. Run ` +
        '`npm run drive:check` then `npm run drive:link -- --apply` to attach the real Drive files.'
        : 'Google Drive is not configured and no local demo video was found in server/demo-media/. ' +
        'Set GOOGLE_SERVICE_ACCOUNT_KEY_FILE in server/.env, or drop a sample.mp4 into server/demo-media/.'
    );
    err.status = 503;
    throw err;
  }

  // ---- Real path: private Google Drive via the Drive API -----------------
  let driveResponse;
  try {
    driveResponse = await driveService.getVideoStream(lesson.driveFileId, rangeHeader);
  } catch (err) {
    // A misconfigured folder/share should not take the demo down: fall back to
    // local media if we have it, and make the real cause obvious in the log.
    const status = err.code || err.status || err.response?.status;
    console.error(
      `[video] Drive request failed for lesson "${lesson.title}" (${status || 'unknown'}): ${err.message}`
    );

    const localFile = resolveLocalMedia(lesson);
    if (localFile) {
      console.error('[video] serving local demo-media fallback instead');
      return streamFromLocalFile(localFile, rangeHeader);
    }

    if (status === 404) {
      err.status = 404;
      err.message =
        `Drive file for lesson "${lesson.title}" was not found, or is not shared with the ` +
        'service account. Run `npm run drive:check`.';
    } else if (status === 403 && driveService.errorReason(err) === 'fileNotDownloadable') {
      // Folders and Google Docs/Sheets have no bytes to stream.
      err.status = 400;
      err.message =
        `Lesson "${lesson.title}" points at a Drive folder or Google document, not a video file. ` +
        "Delete the lesson and add it again with the video's own link (right-click the video → Share → Copy link).";
    } else if (status === 403 && driveService.isDownloadBlocked(err)) {
      // The owner turned on "Viewers and commenters can't download, print or
      // copy". The service account is a Viewer, so Drive refuses the bytes.
      err.status = 403;
      err.message =
        `The Drive video for lesson "${lesson.title}" has downloading turned off, so it cannot be ` +
        'streamed. In Google Drive, open the file → Share → ⚙ Settings → tick "Viewers and ' +
        'commenters can see the option to download, print, and copy".';
    } else if (status === 403 && /quota|rateLimit/i.test(driveService.errorReason(err))) {
      // Drive caps how often one file can be downloaded per day; a popular
      // lesson streamed by many learners can hit it. It clears by itself.
      err.status = 503;
      err.message =
        `Google Drive's daily download limit has been reached for the video of lesson "${lesson.title}" ` +
        '(too many plays today). It resets on its own within 24 hours. To avoid it, keep course videos ' +
        'in a Shared drive owned by your organisation rather than a personal or "anyone with the link" folder.';
    } else if (status === 403) {
      const reason = driveService.errorReason(err);
      err.status = 403;
      err.message =
        `Google refused access to the video for lesson "${lesson.title}"` +
        (reason ? ` (Drive: ${reason})` : '') +
        '. Check that the file is still shared with the service account and that its sharing has not ' +
        'been restricted. Run `npm run drive:check`.';
    }
    throw err;
  }

  // gaxios 7+ returns a fetch `Headers` object (read with .get()); older
  // versions returned a plain object. Bracket access on a Headers object is
  // always undefined, which sent 206 responses with no Content-Range and the
  // browser refused to play them.
  const raw = driveResponse.headers || {};
  const header = (name) => (typeof raw.get === 'function' ? raw.get(name) : raw[name]) || null;
  const contentLength = header('content-length');

  return {
    status: driveResponse.status === 206 ? 206 : 200,
    contentType: header('content-type') || 'video/mp4',
    contentLength: contentLength ? Number(contentLength) : null,
    contentRange: header('content-range'),
    stream: driveResponse.stream,
    source: 'google-drive',
  };
}

/** Non-streaming metadata, used by the "How it works" panel. */
async function getLessonVideoInfo(lessonId) {
  const lesson = await Lesson.findById(lessonId).select('+driveFileId');
  if (!lesson) throw notFound('Lesson not found');

  if (!driveService.isConfigured() || isPlaceholderFileId(lesson.driveFileId)) {
    return { source: 'local-demo-media', available: Boolean(resolveLocalMedia(lesson)) };
  }

  try {
    const meta = await driveService.getVideoMetadata(lesson.driveFileId);
    // Note: only size/mimeType are surfaced. The file id stays server-side.
    return { source: 'google-drive', available: true, size: meta.size, mimeType: meta.mimeType };
  } catch {
    return { source: 'google-drive', available: false };
  }
}

module.exports = { getLessonVideoStream, getLessonVideoInfo };
