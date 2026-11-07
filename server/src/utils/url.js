/**
 * Link validation shared by every admin form that stores a URL: course
 * resources, intro videos, thumbnails, the logo and the homepage / sign-in
 * images.
 *
 * Only http(s) links are accepted, so a stored value can never become a
 * `javascript:` or `data:` link when it is rendered as an <a href> or <img src>.
 */

/**
 * Validates one link.
 *
 *   allowEmpty     ''  is accepted and returned as ''
 *   allowUploads   a site-relative "/uploads/..." path (our own image uploads)
 *   label          used in the error message
 *
 * Returns { value } on success or { error } on failure.
 */
function checkUrl(raw, { allowEmpty = true, allowUploads = false, label = 'Link' } = {}) {
  const value = String(raw ?? '').trim();
  if (!value) return allowEmpty ? { value: '' } : { error: `${label} is required.` };

  if (allowUploads && value.startsWith('/uploads/') && !value.includes('..')) return { value };

  let url;
  try {
    url = new URL(value);
  } catch {
    return { error: `${label} must be a full link starting with https://` };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { error: `${label} must start with https://` };
  }
  return { value: url.href };
}

/**
 * Google Drive hands out several URL shapes for the same file. The
 * `open?id=` and `uc?id=` forms either download straight away or show an
 * interstitial, so they are rewritten to the standard viewer link, which
 * opens the file in the browser for anyone it is shared with.
 */
function normaliseDriveLink(href) {
  try {
    const url = new URL(href);
    if (url.hostname !== 'drive.google.com') return href;
    const id = url.searchParams.get('id');
    if (id && /^\/(open|uc)$/.test(url.pathname)) return `https://drive.google.com/file/d/${id}/view`;
    return href;
  } catch {
    return href;
  }
}

/** Accepts a full Google Sheets URL or a bare spreadsheet id; returns the id or ''. */
function extractSpreadsheetId(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  const match = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(value);
  if (match) return match[1];
  return /^[a-zA-Z0-9-_]{20,}$/.test(value) ? value : '';
}

module.exports = { checkUrl, normaliseDriveLink, extractSpreadsheetId };
