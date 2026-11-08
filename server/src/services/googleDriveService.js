/**
 * Google Drive Service
 * ---------------------------------------------------------------
 * The ONLY place in the codebase that talks to the Google Drive API.
 *
 *   Controller -> Video Service -> Google Drive Service -> Google Drive API
 *
 * Auth is a Google service account (JWT). The Drive folder is private and
 * shared with the service account email, so the files are NOT public and
 * cannot be opened with a drive.google.com link by a student.
 *
 * Credentials are read from either (in order of preference):
 *   1. GOOGLE_SERVICE_ACCOUNT_KEY_FILE — path to the downloaded JSON key.
 *      Preferred: no escaping, and the key never has to be pasted anywhere.
 *   2. GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY — the discrete .env form.
 */
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

/** server/ — relative key-file paths resolve against this. */
const SERVER_ROOT = path.join(__dirname, '..', '..');

let cachedDrive = null;
let cachedCredentials;

function readKeyFile(keyFilePath) {
  const resolved = path.isAbsolute(keyFilePath)
    ? keyFilePath
    : path.join(SERVER_ROOT, keyFilePath);

  if (!fs.existsSync(resolved)) {
    console.warn(`[drive] key file not found: ${resolved}`);
    return null;
  }

  try {
    const json = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    if (!json.client_email || !json.private_key) {
      console.warn('[drive] key file is missing client_email / private_key');
      return null;
    }
    return {
      clientEmail: json.client_email,
      privateKey: json.private_key,
      projectId: json.project_id,
      source: `key file (${path.basename(resolved)})`,
    };
  } catch (err) {
    console.warn(`[drive] key file could not be parsed: ${err.message}`);
    return null;
  }
}

/**
 * Resolve service-account credentials once and cache the result
 * (including a negative result, so we do not stat a missing file per request).
 */
function getCredentials() {
  if (cachedCredentials !== undefined) return cachedCredentials;

  const keyFilePath =
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (keyFilePath) {
    const fromFile = readKeyFile(keyFilePath);
    if (fromFile) {
      cachedCredentials = fromFile;
      return cachedCredentials;
    }
  }

  if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    cachedCredentials = {
      clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
      // .env keeps the key on one line with literal \n sequences.
      privateKey: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      projectId: process.env.GOOGLE_PROJECT_ID,
      source: '.env (GOOGLE_PRIVATE_KEY)',
    };
    return cachedCredentials;
  }

  cachedCredentials = null;
  return cachedCredentials;
}

/** True when usable service-account credentials are available. */
function isConfigured() {
  return Boolean(getCredentials());
}

/**
 * Accept whatever form of the folder reference was pasted into .env and
 * return the bare Drive id.
 *
 * Handles the full share URL (the usual mistake), the /d/ file form, an
 * ?id= query parameter, and stray quotes or whitespace.
 */
function normaliseFolderId(raw) {
  if (!raw) return null;

  const value = String(raw).trim().replace(/^["']|["']$/g, '');
  if (!value) return null;

  const patterns = [/\/folders\/([^/?#\s]+)/, /\/d\/([^/?#\s]+)/, /[?&]id=([^&?#\s]+)/];
  for (const pattern of patterns) {
    const match = pattern.exec(value);
    if (match) return match[1];
  }

  // Not a URL — strip any trailing query string someone appended by hand.
  return value.split(/[?#]/)[0];
}

/** The configured folder id, normalised. */
function getFolderId() {
  return normaliseFolderId(process.env.GOOGLE_DRIVE_FOLDER_ID);
}

/**
 * Confirm the id points at a folder this service account can actually read.
 * Turns "empty listing" into a specific, actionable failure.
 */
async function getFolderMetadata(folderId = getFolderId()) {
  const drive = getDriveClient();
  const { data } = await drive.files.get({
    fileId: folderId,
    fields: 'id, name, mimeType',
    supportsAllDrives: true,
  });
  return { id: data.id, name: data.name, mimeType: data.mimeType };
}

/** Safe summary for the startup log / health endpoint — never includes the key. */
function getConfigSummary() {
  const credentials = getCredentials();
  return {
    configured: Boolean(credentials),
    clientEmail: credentials?.clientEmail || null,
    projectId: credentials?.projectId || null,
    source: credentials?.source || null,
    folderId: normaliseFolderId(process.env.GOOGLE_DRIVE_FOLDER_ID),
    // Surfaced so drive:check can point out a pasted URL was cleaned up.
    rawFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || null,
  };
}

function getDriveClient() {
  if (cachedDrive) return cachedDrive;

  const credentials = getCredentials();
  if (!credentials) {
    const err = new Error(
      'Google Drive is not configured. Set GOOGLE_SERVICE_ACCOUNT_KEY_FILE (path to your ' +
        'service-account JSON) in server/.env, or GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY.'
    );
    err.status = 503;
    throw err;
  }

  const auth = new google.auth.JWT({
    email: credentials.clientEmail,
    key: credentials.privateKey,
    scopes: DRIVE_SCOPES,
  });

  cachedDrive = google.drive({ version: 'v3', auth });
  return cachedDrive;
}

/**
 * Metadata for a private Drive file.
 * Returns additional fields as requested for the Lesson schema.
 */
async function getVideoMetadata(fileId) {
  const drive = getDriveClient();
  const { data } = await drive.files.get({
    fileId,
    fields:
      'id, name, mimeType, size, webViewLink, parents, videoMediaMetadata(durationMillis), capabilities(canDownload), shortcutDetails(targetId, targetMimeType)',
    supportsAllDrives: true,
  });

  let folderId = null;
  let folderName = null;
  
  if (data.parents && data.parents.length > 0) {
    folderId = data.parents[0];
    try {
      // Re-use the existing getFolderMetadata function to get the parent folder's name
      const folderMeta = await getFolderMetadata(folderId);
      folderName = folderMeta.name;
    } catch (err) {
      console.warn(`[drive] Could not fetch parent folder metadata for ${folderId}`);
    }
  }

  return {
    id: data.id,
    name: data.name,
    mimeType: data.mimeType || 'video/mp4',
    size: Number(data.size || 0),
    webViewLink: data.webViewLink || null,
    folderId,
    folderName,
    durationSeconds: data.videoMediaMetadata?.durationMillis
      ? Math.round(Number(data.videoMediaMetadata.durationMillis) / 1000)
      : 0,
    // False when the owner turned on "viewers can't download, print or copy":
    // the service account can see the file but Drive will not stream its bytes.
    canDownload: data.capabilities?.canDownload !== false,
    // Set when this is a Drive shortcut; the caller should use the target instead.
    shortcutTargetId: data.shortcutDetails?.targetId || null,
  };
}

/** True when Drive refused a download because the file's owner disabled downloads for viewers. */
function isDownloadBlocked(err) {
  const reason = err?.errors?.[0]?.reason || err?.response?.data?.error?.errors?.[0]?.reason;
  return reason === 'cannotDownloadFile' || /cannotDownloadFile|cannot be downloaded/i.test(String(err?.message || ''));
}

/**
 * List the video files inside the configured Drive folder.
 *
 * Used only by the setup scripts (`npm run drive:check` / `drive:link`) —
 * never by a request path, so no listing can reach the client.
 */
async function listFolderVideos(rawFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID) {
  const folderId = normaliseFolderId(rawFolderId);
  if (!folderId) {
    const err = new Error('GOOGLE_DRIVE_FOLDER_ID is not set in server/.env');
    err.status = 503;
    throw err;
  }

  const drive = getDriveClient();
  const files = [];
  let pageToken;

  do {
    const { data } = await drive.files.list({
      q:
        `'${folderId}' in parents and trashed = false and ` +
        "(mimeType contains 'video/' or mimeType = 'application/vnd.google-apps.shortcut')",
      fields:
        'nextPageToken, files(id, name, mimeType, size, videoMediaMetadata(durationMillis), capabilities(canDownload), shortcutDetails(targetId, targetMimeType))',
      orderBy: 'name_natural',
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    for (const file of data.files || []) {
      if (!file.shortcutDetails) {
        files.push(file);
        continue;
      }
      // A shortcut to a video: stream the target, but keep the shortcut's name,
      // which is the one numbered for this folder ("09_….MOV").
      if (!String(file.shortcutDetails.targetMimeType || '').startsWith('video/')) continue;
      try {
        const { data: target } = await drive.files.get({
          fileId: file.shortcutDetails.targetId,
          fields: 'id, mimeType, size, videoMediaMetadata(durationMillis), capabilities(canDownload)',
          supportsAllDrives: true,
        });
        files.push({ ...target, name: file.name });
      } catch (err) {
        console.warn(
          `[drive] Skipped shortcut "${file.name}": the video it points to is not shared with the service account (${err.code || err.message}).`
        );
      }
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return files.map((file) => ({
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    size: Number(file.size || 0),
    durationSeconds: file.videoMediaMetadata?.durationMillis
      ? Math.round(Number(file.videoMediaMetadata.durationMillis) / 1000)
      : null,
    // False when the owner turned off downloads for viewers: it cannot be streamed.
    canDownload: file.capabilities?.canDownload !== false,
  }));
}

/**
 * Sub-folders directly inside a folder.
 *
 * The importer treats each one as a course, so a Drive layout of
 * "lms / React Basics / 01 Intro.mp4" becomes a course with lessons.
 */
async function listSubFolders(parentId = getFolderId()) {
  const drive = getDriveClient();
  const { data } = await drive.files.list({
    q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    orderBy: 'name_natural',
    pageSize: 100,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return data.files || [];
}

/**
 * Every folder the service account can currently see.
 *
 * Setup aid only (`npm run drive:check`): if GOOGLE_DRIVE_FOLDER_ID is unset
 * or wrong, this tells you which folders have actually been shared with the
 * service account, and their ids.
 */
async function listSharedFolders() {
  const drive = getDriveClient();
  const { data } = await drive.files.list({
    q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    fields: 'files(id, name)',
    pageSize: 50,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return data.files || [];
}

/**
 * Open a read stream for the file's bytes.
 *
 * `range` is the raw browser Range header (e.g. "bytes=0-1048575") and is
 * forwarded untouched to Google, so Drive itself serves the partial content.
 * That keeps seeking cheap — we never buffer the whole file in Node.
 *
 * Returns { status, headers, stream } straight from the Drive response:
 *   206 + content-range when a Range was forwarded, 200 otherwise.
 */
/**
 * With responseType 'stream', a failed request's JSON body arrives as an
 * unread stream, so `err.errors` is empty and the reason (cannotDownloadFile,
 * downloadQuotaExceeded, notFound…) is lost. Read it and put it where the
 * other Drive calls have it.
 */
async function readStreamedError(err) {
  const body = err?.response?.data;
  const applyJson = (text) => {
    const parsed = JSON.parse(text);
    if (err.response) err.response.data = parsed;
    if (parsed?.error?.errors) err.errors = parsed.error.errors;
    if (parsed?.error?.message) err.message = parsed.error.message;
  };
  // Newer gaxios reads the body itself and leaves the raw JSON as the message.
  if (typeof err?.message === 'string' && err.message.trim().startsWith('{')) {
    try {
      applyJson(err.message);
      return;
    } catch {
      /* not JSON after all */
    }
  }
  if (!body || typeof body.on !== 'function') return;
  const text = await new Promise((resolve) => {
    let raw = '';
    const done = () => resolve(raw);
    body.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 16384) body.destroy();
    });
    body.on('end', done);
    body.on('close', done);
    body.on('error', done);
    setTimeout(done, 5000);
  });
  try {
    applyJson(text);
  } catch {
    if (text) err.response.data = text.slice(0, 500);
  }
}

/** Drive's machine-readable reason for a failed call, e.g. "downloadQuotaExceeded". */
function errorReason(err) {
  return err?.errors?.[0]?.reason || err?.response?.data?.error?.errors?.[0]?.reason || '';
}

async function getVideoStream(fileId, range) {
  const drive = getDriveClient();
  const headers = {};
  if (range) headers.Range = range;

  let response;
  try {
    response = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream', headers }
    );
  } catch (err) {
    await readStreamedError(err);
    throw err;
  }

  return {
    status: response.status,
    headers: response.headers,
    stream: response.data,
  };
}

module.exports = {
  // Shared with googleSheetsService, which signs in as the same service account.
  getCredentials,
  isConfigured,
  isDownloadBlocked,
  errorReason,
  getConfigSummary,
  getVideoMetadata,
  normaliseFolderId,
  getFolderId,
  getFolderMetadata,
  listFolderVideos,
  listSubFolders,
  listSharedFolders,
  getVideoStream,
};
