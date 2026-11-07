/**
 * Returns the link when it is a plain http(s) URL, otherwise ''. Used before
 * putting an admin-supplied link into an href, so a stored value can never
 * run as a `javascript:` URL in a learner's browser.
 */
export function safeExternalUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const url = new URL(text);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

/** True for a link the server will accept: http(s), or one of our own /uploads/ images when allowed. */
export function isValidLink(value, { allowUploads = false } = {}) {
  const text = String(value || '').trim();
  if (!text) return true;
  if (allowUploads && text.startsWith('/uploads/')) return true;
  return Boolean(safeExternalUrl(text));
}
