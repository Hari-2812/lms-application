/**
 * LMS "Enroll Now" popup → this Google Sheet.
 *
 * An add-on for a sheet whose Apps Script already has a doPost (for example
 * the website's CTA / contact / job forms). It adds one more form type,
 * "lms_enquiry", and writes those rows to their own tab (LMS_ENQUIRIES).
 * Nothing in the existing code changes apart from one line in doPost.
 *
 * Setup (once)
 *   1. Sheet → Extensions → Apps Script.
 *   2. Next to "Files" press + → Script, name it LmsEnquiries, delete what is
 *      in it, paste this whole file, and Save.
 *   3. In Code.gs, inside doPost, right after the line
 *          const data = JSON.parse(e.postData.contents);
 *      add:
 *          if (data.formType === "lms_enquiry") return handleLmsEnquiry(data);
 *      and Save.
 *   4. Deploy → Manage deployments → Edit (pencil) → Version: New version →
 *      Deploy. The web app URL stays the same, so the website forms keep
 *      working. (No deployment yet? Deploy → New deployment → Web app,
 *      Execute as: Me, Who has access: Anyone.)
 *   5. Paste that web app URL (ends in /exec) in LMS → Admin → LMS settings →
 *      Google Sheet, Save, and press Test connection.
 *
 * A sheet with no Apps Script yet only needs this file plus:
 *     function doPost(e) { return handleLmsEnquiry(JSON.parse(e.postData.contents)); }
 */

// Must match this site's secret. Copy this file from LMS settings → Google
// Sheet and the line is filled in for you. Requests without it are refused —
// the web app URL is public (the website's forms call it from the browser).
const LMS_SECRET = 'PASTE_SECRET_FROM_LMS_SETTINGS';

// Used when no tab name is set in LMS settings. Created if missing.
const LMS_DEFAULT_TAB = 'LMS_ENQUIRIES';

/** body: { formType: 'lms_enquiry', secret, action: 'test' | 'append', tab, headers, row } */
function handleLmsEnquiry(body) {
  try {
    if (!body || body.secret !== LMS_SECRET) {
      return lmsReply({
        ok: false,
        error: 'The secret does not match. Copy the LmsEnquiries script again from LMS settings → Google Sheet, paste it into Apps Script, and deploy a new version.',
      });
    }

    // Two enquiries arriving together must not both write the header row.
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      const name = String(body.tab || '').trim() || LMS_DEFAULT_TAB;
      const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
      const headerWritten = lmsEnsureHeader(sheet, body.headers);

      if (body.action === 'append') {
        if (!Array.isArray(body.row)) return lmsReply({ ok: false, error: 'No row was sent.' });
        sheet.appendRow(body.row.map(lmsAsText));
      }

      return lmsReply({
        ok: true,
        title: spreadsheet.getName(),
        tab: sheet.getName(),
        url: spreadsheet.getUrl(),
        headerWritten: headerWritten,
      });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return lmsReply({ ok: false, error: String((err && err.message) || err) });
  }
}

/** Writes the column headings into row 1 when that row is empty. */
function lmsEnsureHeader(sheet, headers) {
  if (!Array.isArray(headers) || !headers.length) return false;
  if (sheet.getLastRow() > 0) {
    const firstRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
    if (firstRow.some(function (cell) { return String(cell).trim() !== ''; })) return false;
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers.map(lmsAsText)]);
  return true;
}

/**
 * Stores a value exactly as typed. The leading apostrophe (hidden in the
 * sheet) stops "+91 98…" turning into a formula error, long numbers losing
 * digits, and visitor text such as "=HYPERLINK(…)" running as a formula.
 */
function lmsAsText(value) {
  if (value === null || value === undefined || value === '') return '';
  return "'" + String(value);
}

function lmsReply(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
