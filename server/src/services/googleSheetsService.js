const fs = require('fs');
const path = require('path');

/**
 * Appends rows to a Google Sheet through the sheet's Google Apps Script web
 * app. The sheet's script may already serve other forms (the website's CTA,
 * contact and job forms), so the LMS part is an add-on file
 * (src/apps-script/LmsEnquiries.gs) reached with formType "lms_enquiry" —
 * one line in the existing doPost routes it. No Google Cloud project, Sheets
 * API or service account is needed.
 *
 * Each request carries the shared secret from Settings, which the script
 * checks: the web app URL is public, because the website's forms call it
 * from the browser.
 */

const SCRIPT_FILE = path.join(__dirname, '../apps-script/LmsEnquiries.gs');
const SECRET_PLACEHOLDER = 'PASTE_SECRET_FROM_LMS_SETTINGS';
const FORM_TYPE = 'lms_enquiry';
const TIMEOUT_MS = 30000;

let scriptTemplate = null;

/** The Apps Script add-on with this site's secret filled in, ready to paste ('' if the file is missing). */
function scriptSource(secret) {
  if (scriptTemplate === null) {
    try {
      scriptTemplate = fs.readFileSync(SCRIPT_FILE, 'utf8');
    } catch (err) {
      // Never take the settings page down over this; it just shows no script.
      console.error('[sheets] Apps Script template missing:', err.message);
      return '';
    }
  }
  return secret ? scriptTemplate.replace(SECRET_PLACEHOLDER, secret) : scriptTemplate;
}

function sheetsError(message, status = 502) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/** Plain text of an HTML error page, for the message the admin sees. */
const pageText = (html) =>
  String(html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);

/** Turns a response that is not the script's JSON into an instruction the admin can act on. */
function explainPage(status, text) {
  if (status === 404) {
    return sheetsError('Google could not find that Apps Script web app. Copy the Web app URL again from Apps Script → Deploy → Manage deployments.');
  }
  if (/accounts\.google\.com|ServiceLogin|Sign in/i.test(text) || status === 401 || status === 403) {
    return sheetsError(
      'The Apps Script web app needs sign-in. In Apps Script → Deploy → Manage deployments → Edit, set "Who has access" to "Anyone", then Deploy.'
    );
  }
  if (/doPost/i.test(text)) {
    return sheetsError('The Apps Script has no doPost function. Paste the script from Settings into Apps Script and deploy a new version.');
  }
  const detail = pageText(text);
  return sheetsError(`The Apps Script web app returned an unexpected response (HTTP ${status})${detail ? `: ${detail}` : ''}.`);
}

/** POSTs one request to the web app and returns its JSON reply. Throws an explained error. */
async function callScript(config, payload) {
  if (!config.googleSheetWebAppUrl) {
    throw sheetsError('No Apps Script web app URL is set in Settings → Google Sheet.', 400);
  }

  let res;
  let text;
  try {
    // Apps Script answers a POST with a redirect to the result; fetch follows it as a GET.
    res = await fetch(config.googleSheetWebAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, formType: FORM_TYPE, secret: config.googleSheetSecret, tab: config.googleSheetTab || '' }),
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    text = await res.text();
  } catch (err) {
    const reason = err.name === 'TimeoutError' ? 'it did not answer in time' : err.message;
    throw sheetsError(`Could not reach the Apps Script web app: ${reason}.`);
  }

  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    throw explainPage(res.status, text);
  }
  // The sheet's own doPost answers { success, message } — so the LMS line is not in it yet.
  if (data && data.ok === undefined && 'success' in data) {
    throw sheetsError(
      `The sheet's Apps Script did not route the LMS form (it said: "${data.message || 'no message'}"). ` +
        'Add the LmsEnquiries file and the lms_enquiry line to doPost, then Deploy → Manage deployments → Edit → New version.'
    );
  }
  if (!data?.ok) throw sheetsError(`Google Sheet script: ${data?.error || 'unknown error'}`);
  return data;
}

/**
 * Appends one row under `headers` (written first if the sheet is empty).
 * `config` is Settings → integrations. Throws an explained error on failure.
 */
async function appendRow(config, headers, row) {
  await callScript(config, {
    action: 'append',
    headers,
    row: row.map((cell) => (cell === null || cell === undefined ? '' : String(cell))),
  });
}

/**
 * Checks the sheet can be written to, writing the header row if it is
 * missing. Returns { title, tab, url, headerWritten }.
 */
async function testConnection(config, headers) {
  const { title, tab, url, headerWritten } = await callScript(config, { action: 'test', headers });
  return { title, tab, url, headerWritten: Boolean(headerWritten) };
}

module.exports = { appendRow, testConnection, scriptSource };
