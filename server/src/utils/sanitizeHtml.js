/**
 * Minimal allowlist HTML sanitiser for admin-authored rich text.
 *
 * The admin course editor stores formatted copy (bold, italic, font family,
 * font size, lists) as HTML. That HTML is rendered back into the student-
 * facing catalogue with `dangerouslySetInnerHTML`, so it has to be cleaned
 * on the way in — an admin account should not be able to plant a <script>
 * tag, an onclick handler or a javascript: URL in the course description.
 *
 * Deliberately small and dependency-free: it parses nothing, it just walks
 * the tag stream and drops anything that is not on the allowlist. The output
 * is sanitised again in the browser before it is rendered (see
 * client/src/utils/sanitize.js), so this is the first of two passes rather
 * than the only line of defence.
 */

// Tags the editor's toolbar can produce, plus the ones a paste can bring in.
const ALLOWED_TAGS = new Set([
  'p', 'br', 'div', 'span',
  'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'sub', 'sup', 'mark',
  'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'pre', 'code',
  'a',
  'hr',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
]);

// Tags whose *contents* must go too — otherwise stripping <script> would
// leave the script body behind as visible text.
const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|noscript|template|svg|math)\b[\s\S]*?<\/\1\s*>/gi;

const ALLOWED_ATTRS = { a: new Set(['href', 'title', 'target', 'rel']) };
const GLOBAL_ATTRS = new Set(['style', 'class']);

// CSS properties the font/size/colour toolbar needs. Anything else (position,
// background-image, behaviour…) is dropped.
const ALLOWED_CSS = new Set([
  'font-family', 'font-size', 'font-style', 'font-weight',
  'text-decoration', 'text-decoration-line', 'text-align', 'text-transform',
  'color', 'background-color', 'line-height', 'letter-spacing',
]);

/** Keeps only safe declarations from a style attribute. */
function sanitiseStyle(value) {
  return value
    .split(';')
    .map((declaration) => {
      const index = declaration.indexOf(':');
      if (index < 0) return null;

      const property = declaration.slice(0, index).trim().toLowerCase();
      const propertyValue = declaration.slice(index + 1).trim();

      if (!ALLOWED_CSS.has(property)) return null;
      // url(...) and expression(...) are the two ways a style attribute can
      // still reach out of the page.
      if (/url\s*\(|expression\s*\(|[<>]/i.test(propertyValue)) return null;
      if (!propertyValue) return null;

      return `${property}: ${propertyValue}`;
    })
    .filter(Boolean)
    .join('; ');
}

/** True for hrefs we are willing to render as links. */
function isSafeHref(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('#') || trimmed.startsWith('/')) return true;
  return /^(https?:|mailto:|tel:)/i.test(trimmed);
}

/** Rebuilds a tag's attribute list from the allowlist. */
function sanitiseAttributes(tagName, raw) {
  const allowed = ALLOWED_ATTRS[tagName];
  const parts = [];

  // name="value" | name='value' | name=value | name
  const pattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>`]+)))?/g;
  let match;

  while ((match = pattern.exec(raw))) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? '';

    if (!GLOBAL_ATTRS.has(name) && !allowed?.has(name)) continue;
    // Belt and braces: every on* handler is an attribute, and none are allowed.
    if (name.startsWith('on')) continue;

    if (name === 'style') {
      const style = sanitiseStyle(value);
      if (style) parts.push(`style="${escapeAttr(style)}"`);
      continue;
    }

    if (name === 'href') {
      if (!isSafeHref(value)) continue;
      parts.push(`href="${escapeAttr(value.trim())}"`);
      continue;
    }

    if (name === 'target') {
      // Only _blank is useful here, and it always needs the rel guard.
      if (value.trim() !== '_blank') continue;
      parts.push('target="_blank"', 'rel="noopener noreferrer"');
      continue;
    }

    if (name === 'rel') continue; // set alongside target above

    parts.push(`${name}="${escapeAttr(value)}"`);
  }

  return parts.length ? ` ${[...new Set(parts)].join(' ')}` : '';
}

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Returns `html` with every tag outside the allowlist removed. Text content
 * is preserved, so stripping formatting never loses the copy itself.
 */
function sanitizeHtml(html) {
  if (typeof html !== 'string' || !html) return '';

  let output = html;
  // Comments can hide conditional markup, and these elements take their
  // contents with them.
  output = output.replace(/<!--[\s\S]*?-->/g, '');
  let previous;
  do {
    previous = output;
    output = output.replace(DROP_WITH_CONTENT, '');
  } while (output !== previous); // nested/overlapping cases need a second pass
  // An unclosed <script ...> would otherwise survive the pass above.
  output = output.replace(/<\/?(script|style|iframe|object|embed|noscript|template|svg|math)\b[^>]*>/gi, '');

  return output.replace(/<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g, (match, rawTag, rawAttrs) => {
    const tagName = rawTag.toLowerCase();
    if (!ALLOWED_TAGS.has(tagName)) return '';

    const isClosing = match.startsWith('</');
    if (isClosing) return `</${tagName}>`;

    const selfClosing = /\/\s*$/.test(rawAttrs);
    const attrs = sanitiseAttributes(tagName, rawAttrs);
    return selfClosing || tagName === 'br' || tagName === 'hr'
      ? `<${tagName}${attrs} />`
      : `<${tagName}${attrs}>`;
  });
}

/** Rich text reduced to plain text — used for card summaries and excerpts. */
function htmlToText(html) {
  if (typeof html !== 'string' || !html) return '';
  return sanitizeHtml(html)
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { sanitizeHtml, htmlToText };
