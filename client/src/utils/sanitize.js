/**
 * Browser-side sanitiser for admin-authored rich text.
 *
 * The server already cleans this HTML when the admin saves it
 * (server/src/utils/sanitizeHtml.js). This is the second pass, run on
 * everything immediately before it reaches `dangerouslySetInnerHTML`, so a
 * course record that was written directly to the database — or by an older
 * build that predates the server sanitiser — still cannot inject script into
 * a student's session.
 *
 * Uses DOMParser rather than regexes: the browser's own parser decides what
 * the markup actually means, and we then walk the resulting tree and delete
 * anything not on the allowlist.
 */

const ALLOWED_TAGS = new Set([
  'P', 'BR', 'DIV', 'SPAN',
  'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'SUB', 'SUP', 'MARK',
  'UL', 'OL', 'LI',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'BLOCKQUOTE', 'PRE', 'CODE',
  'A',
  'HR',
  'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD',
]);

const ALLOWED_CSS = new Set([
  'font-family', 'font-size', 'font-style', 'font-weight',
  'text-decoration', 'text-decoration-line', 'text-align', 'text-transform',
  'color', 'background-color', 'line-height', 'letter-spacing',
]);

const SAFE_HREF = /^(https?:|mailto:|tel:|\/|#)/i;

/** Copies across only the style declarations the toolbar can produce. */
function sanitiseStyle(element) {
  const declarations = [];

  for (const property of Array.from(element.style)) {
    if (!ALLOWED_CSS.has(property)) continue;
    const value = element.style.getPropertyValue(property);
    if (!value || /url\s*\(|expression\s*\(/i.test(value)) continue;
    declarations.push(`${property}: ${value}`);
  }

  if (declarations.length) element.setAttribute('style', declarations.join('; '));
  else element.removeAttribute('style');
}

function sanitiseElement(element) {
  // Strip every attribute first, then put back the few that are allowed.
  // Iterating over a copy because removeAttribute mutates the live list.
  for (const { name } of Array.from(element.attributes)) {
    const lower = name.toLowerCase();
    if (lower === 'style' || lower === 'class') continue;
    if (element.tagName === 'A' && (lower === 'href' || lower === 'title' || lower === 'target' || lower === 'rel')) {
      continue;
    }
    element.removeAttribute(name);
  }

  sanitiseStyle(element);

  if (element.tagName === 'A') {
    const href = element.getAttribute('href') || '';
    if (!SAFE_HREF.test(href.trim())) element.removeAttribute('href');
    if (element.getAttribute('target') === '_blank') {
      element.setAttribute('rel', 'noopener noreferrer');
    } else {
      element.removeAttribute('target');
      element.removeAttribute('rel');
    }
  }
}

/** Replaces a disallowed element with its own children, keeping the text. */
function unwrap(element) {
  const parent = element.parentNode;
  if (!parent) return;
  while (element.firstChild) parent.insertBefore(element.firstChild, element);
  parent.removeChild(element);
}

/**
 * Returns `html` with everything outside the allowlist removed. Text survives
 * even when its wrapper does not, so an unsupported tag costs formatting
 * rather than content.
 */
export function sanitizeHtml(html) {
  if (typeof html !== 'string' || !html.trim()) return '';
  // No DOMParser during SSR or in a test runner without a DOM — returning
  // empty is the safe direction to fail in.
  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') return '';

  const doc = new window.DOMParser().parseFromString(html, 'text/html');

  // Elements whose content must go with them. Walked before the unwrap pass
  // so their text never gets promoted into the output.
  doc.body.querySelectorAll('script, style, iframe, object, embed, noscript, template, svg, math, link, meta, img, video, audio, form, input, button')
    .forEach((element) => element.remove());

  // Depth-first over a static list: unwrapping moves children up, and a
  // live NodeList would skip the nodes that shift position.
  for (const element of Array.from(doc.body.querySelectorAll('*'))) {
    if (!element.isConnected) continue;
    if (!ALLOWED_TAGS.has(element.tagName)) {
      unwrap(element);
      continue;
    }
    sanitiseElement(element);
  }

  return doc.body.innerHTML;
}

/** Rich text as plain text — for card excerpts and meta descriptions. */
export function htmlToText(html) {
  if (typeof html !== 'string' || !html) return '';
  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const doc = new window.DOMParser().parseFromString(html, 'text/html');

  // textContent alone would run adjacent blocks together ("HiThere you" from
  // "<h2>Hi</h2><p>There you</p>"), so each block gets a separator first.
  doc.body
    .querySelectorAll('p, div, br, li, h1, h2, h3, h4, h5, h6, tr, blockquote, pre')
    .forEach((element) => element.append(doc.createTextNode(' ')));

  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

/** True when rich text has something in it beyond empty tags. */
export function hasRichText(html) {
  return htmlToText(html).length > 0;
}
