const { google } = require('googleapis');
const { getCredentials } = require('./googleDriveService');

/**
 * Appends rows to a Google Sheet as the server's Google service account —
 * the same account that reads lesson videos from Drive.
 *
 * Setup the admin does once (shown in Admin → LMS settings → Google Sheet):
 *   1. Enable the Google Sheets API in the service account's Cloud project.
 *   2. Share the sheet with the service account's email as Editor.
 *
 * Values are written RAW, so text a visitor typed (e.g. "=HYPERLINK(...)")
 * is stored as text and never evaluated as a formula.
 */

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

let cachedClient = null;

function sheetsError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  // Marks errors already worded for the admin, so they are not explained twice.
  err.explained = true;
  return err;
}

function getSheetsClient() {
  if (cachedClient) return cachedClient;
  const credentials = getCredentials();
  if (!credentials) {
    throw sheetsError('No Google service account is configured on the server, so the sheet cannot be written to.', 503);
  }
  const auth = new google.auth.JWT({ email: credentials.clientEmail, key: credentials.privateKey, scopes: SCOPES });
  cachedClient = google.sheets({ version: 'v4', auth });
  return cachedClient;
}

/** Turns a Google API failure into an instruction the admin can act on. */
function explain(err) {
  const status = Number(err?.code || err?.response?.status) || 0;
  const detail = String(err?.response?.data?.error?.message || err?.message || '');
  const email = getCredentials()?.clientEmail || 'the service account';

  if (/has not been used|is disabled|SERVICE_DISABLED/i.test(detail)) {
    const projectId = getCredentials()?.projectId;
    return sheetsError(
      `The Google Sheets API is not enabled for the service account's project${projectId ? ` (${projectId})` : ''}. ` +
        'Enable it in Google Cloud Console → APIs & Services → Library → Google Sheets API, then try again.',
      502
    );
  }
  if (status === 403 || /permission/i.test(detail)) {
    return sheetsError(`The sheet is not shared with ${email}. Open the sheet → Share → add that address as Editor.`, 502);
  }
  if (status === 404 || /not found/i.test(detail)) {
    return sheetsError('Google could not find that sheet. Check the sheet link in Settings.', 502);
  }
  return sheetsError(`Google Sheets error: ${detail || 'unknown error'}`, 502);
}

const quoteTab = (tab) => `'${String(tab).replace(/'/g, "''")}'`;

/**
 * Finds the tab to write to: the configured name (created if missing), or
 * the first tab when none is configured. Returns { tab, title }.
 */
async function resolveTab(sheets, spreadsheetId, tabName) {
  const { data } = await sheets.spreadsheets.get({ spreadsheetId, fields: 'properties.title,sheets.properties.title' });
  const tabs = (data.sheets || []).map((s) => s.properties.title);
  const wanted = String(tabName || '').trim();

  if (!wanted) return { tab: tabs[0] || 'Sheet1', title: data.properties?.title };
  if (!tabs.includes(wanted)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: wanted } } }] },
    });
  }
  return { tab: wanted, title: data.properties?.title };
}

/** Writes the header row if the tab's first row is empty. */
async function ensureHeader(sheets, spreadsheetId, tab, headers) {
  const { data } = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${quoteTab(tab)}!1:1` });
  if (data.values?.[0]?.some((cell) => String(cell).trim())) return false;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${quoteTab(tab)}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [headers] },
  });
  return true;
}

/**
 * Appends one row under `headers` (written first if the sheet is empty).
 * `config` is Settings → integrations. Throws an explained error on failure.
 */
async function appendRow(config, headers, row) {
  if (!config.googleSheetId) throw sheetsError('No Google Sheet is set in Settings.');
  const sheets = getSheetsClient();
  try {
    const { tab } = await resolveTab(sheets, config.googleSheetId, config.googleSheetTab);
    await ensureHeader(sheets, config.googleSheetId, tab, headers);
    await sheets.spreadsheets.values.append({
      spreadsheetId: config.googleSheetId,
      range: `${quoteTab(tab)}!A1`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row.map((cell) => (cell === null || cell === undefined ? '' : String(cell)))] },
    });
  } catch (err) {
    throw err.explained ? err : explain(err);
  }
}

/**
 * Checks the sheet can be written to, writing the header row if it is
 * missing. Returns { title, tab, headerWritten }.
 */
async function testConnection(config, headers) {
  if (!config.googleSheetId) throw sheetsError('Add the Google Sheet link first.');
  const sheets = getSheetsClient();
  try {
    const { tab, title } = await resolveTab(sheets, config.googleSheetId, config.googleSheetTab);
    const headerWritten = await ensureHeader(sheets, config.googleSheetId, tab, headers);
    return { title, tab, headerWritten };
  } catch (err) {
    throw err.explained ? err : explain(err);
  }
}

module.exports = { appendRow, testConnection };
