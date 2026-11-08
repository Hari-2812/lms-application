/**
 * Drive connection check: npm run drive:check
 *
 * Verifies, without touching the database:
 *   1. credentials load,
 *   2. the service account can authenticate,
 *   3. the configured folder is reachable and shared with it,
 *   4. which video files it contains.
 *
 * Run this before `npm run drive:link` — it turns the usual opaque 403/404
 * into a specific instruction.
 */
require('dotenv').config();

const driveService = require('../services/googleDriveService');

function fail(message, hint) {
  console.error(`\n  ✗ ${message}`);
  if (hint) console.error(`\n    ${hint.replace(/\n/g, '\n    ')}`);
  console.error('');
  process.exit(1);
}

async function main() {
  const summary = driveService.getConfigSummary();

  console.log('\n  Google Drive configuration');
  console.log('  ─────────────────────────────────────────────');
  console.log(`  credentials   ${summary.source || 'NOT FOUND'}`);
  console.log(`  client_email  ${summary.clientEmail || '—'}`);
  console.log(`  project_id    ${summary.projectId || '—'}`);
  console.log(`  folder id     ${summary.folderId || 'NOT SET'}`);
  console.log('');

  if (!summary.configured) {
    fail(
      'No service-account credentials found.',
      'Put your JSON key in server/credentials/ and set in server/.env:\n' +
        'GOOGLE_SERVICE_ACCOUNT_KEY_FILE=credentials/service-account.json'
    );
  }

  if (!summary.folderId) {
    // Credentials work, so we can at least show what has been shared and
    // hand over the exact id to paste into .env.
    let folders = [];
    try {
      folders = await driveService.listSharedFolders();
    } catch {
      /* fall through to the generic instruction below */
    }

    if (folders.length) {
      console.log('  Folders shared with this service account:\n');
      folders.forEach((folder) => console.log(`   • ${folder.name}\n     id=${folder.id}`));
      fail(
        'GOOGLE_DRIVE_FOLDER_ID is not set.',
        'Copy the id of the folder you want above into server/.env:\n' +
          'GOOGLE_DRIVE_FOLDER_ID=<id>'
      );
    }

    fail(
      'GOOGLE_DRIVE_FOLDER_ID is not set, and no folder has been shared with\n' +
        `    ${summary.clientEmail}`,
      'In Google Drive:\n' +
        '  1. create (or open) the folder holding your lesson videos\n' +
        `  2. right-click -> Share -> paste ${summary.clientEmail} -> Viewer -> Send\n` +
        '  3. copy the folder id from its URL:\n' +
        '     https://drive.google.com/drive/folders/<THIS_PART>\n' +
        '  4. put it in server/.env as GOOGLE_DRIVE_FOLDER_ID, then re-run this check'
    );
  }

  // A pasted share URL still works, but say so — the .env value is misleading.
  if (summary.rawFolderId && summary.rawFolderId !== summary.folderId) {
    console.log('  Note: GOOGLE_DRIVE_FOLDER_ID contains a full URL. Using the id from it.');
    console.log(`        Tidy server/.env to:  GOOGLE_DRIVE_FOLDER_ID=${summary.folderId}\n`);
  }

  // Resolve the folder itself first: an empty listing and an unshared folder
  // look identical otherwise.
  let folder;
  try {
    folder = await driveService.getFolderMetadata();
  } catch (err) {
    const status = err.code || err.status || err.response?.status;

    if (status === 404) {
      fail(
        `No folder with id ${summary.folderId} is visible to this service account.`,
        'Either the id is wrong, or the folder has not been shared with:\n' +
          `${summary.clientEmail}\n\n` +
          'In Drive: right-click the folder -> Share -> paste that address -> Viewer -> Send.\n' +
          'Sharing a *parent* folder is enough; sharing the file only is not.'
      );
    }
    if (status === 403) {
      fail(
        'Google refused the request (403).',
        'Usually one of:\n' +
          '  • the Drive API is not enabled for this project — enable it at\n' +
          '    https://console.cloud.google.com/apis/library/drive.googleapis.com\n' +
          `  • the folder is not shared with ${summary.clientEmail}`
      );
    }
    fail(err.message);
  }

  if (folder.mimeType !== 'application/vnd.google-apps.folder') {
    fail(
      `That id points at a file ("${folder.name}"), not a folder.`,
      'GOOGLE_DRIVE_FOLDER_ID must be the folder that contains your videos.'
    );
  }

  console.log(`  ✓ Folder reachable: "${folder.name}"\n`);

  let files;
  try {
    files = await driveService.listFolderVideos();
  } catch (err) {
    const status = err.code || err.status || err.response?.status;

    if (status === 404) {
      fail(
        `Folder ${summary.folderId} was not found.`,
        'Either the id is wrong, or the folder has not been shared with:\n' +
          `${summary.clientEmail}\n\n` +
          'In Drive: right-click the folder -> Share -> paste that address -> Viewer.'
      );
    }
    if (status === 403) {
      fail(
        'Google refused the request (403).',
        'Usually one of:\n' +
          '  • the Drive API is not enabled for this project — enable it at\n' +
          '    https://console.cloud.google.com/apis/library/drive.googleapis.com\n' +
          `  • the folder is not shared with ${summary.clientEmail}`
      );
    }
    if (String(err.message).includes('invalid_grant')) {
      fail(
        'Authentication failed (invalid_grant).',
        'The key is malformed, revoked, or your system clock is out of sync.\n' +
          'Create a fresh JSON key in Google Cloud Console and try again.'
      );
    }
    fail(err.message);
  }

  // One sub-folder per course (e.g. SQL / PYTHON / POWER BI) is the layout
  // drive:import expects, so report those instead of failing.
  if (files.length === 0) {
    const subFolders = await driveService.listSubFolders(folder.id).catch(() => []);
    const withVideos = [];
    for (const sub of subFolders) {
      const videos = await driveService.listFolderVideos(sub.id).catch(() => []);
      if (videos.length) withVideos.push({ ...sub, videos });
    }
    if (withVideos.length) {
      console.log(`  ✓ Connected. Videos are in ${withVideos.length} sub-folder(s) — one per course:\n`);
      for (const sub of withVideos) {
        console.log(`   ${sub.name}  (${sub.videos.length} video${sub.videos.length === 1 ? '' : 's'})  folder id=${sub.id}`);
        sub.videos.forEach((file) =>
          console.log(`      ${file.canDownload ? '-' : '✗'} ${file.name}${file.canDownload ? '' : '   ← downloading turned off: will not play'}`)
        );
      }
      console.log(
        '\n  Next: fill a course from its folder (dry run first, then add --apply):\n' +
          '    npm run drive:import -- --course=<course id or slug> --folder=<folder id above>\n'
      );
      return;
    }
    fail(
      `Folder "${folder.name}" is reachable but contains no video files.`,
      'Upload your lesson .mp4 files directly into that folder, then re-run.\n' +
        'Note: videos in sub-folders are not picked up — point\n' +
        'GOOGLE_DRIVE_FOLDER_ID at the folder that holds the files themselves.'
    );
  }

  console.log(`  ✓ Connected. ${files.length} video file(s) in the folder:\n`);
  files.forEach((file, i) => {
    const mb = file.size ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : '—';
    const duration = file.durationSeconds ? `${file.durationSeconds}s` : 'unknown length';
    console.log(`   ${String(i + 1).padStart(2, '0')}. ${file.name}`);
    console.log(`       id=${file.id}  ${mb}  ${duration}`);
  });

  console.log('\n  Next: npm run drive:link   (maps these files onto lessons)\n');
}

main().catch((err) => {
  console.error('\n[drive:check] unexpected failure:', err.message, '\n');
  process.exit(1);
});
