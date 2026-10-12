import { useMemo } from 'react';
import { sanitizeHtml } from '../../utils/sanitize.js';

/**
 * Renders the formatted copy an admin wrote in the course editor.
 *
 * The HTML is sanitised here, at the point of render, rather than trusted
 * from the API — see utils/sanitize.js for what survives. The `prose-course`
 * class in index.css is what gives the admin's headings, lists and links
 * sensible spacing without a typography plugin.
 */
export default function RichText({ html, className = '' }) {
  const clean = useMemo(() => sanitizeHtml(html), [html]);

  if (!clean) return null;

  return (
    <div
      className={`prose-course ${className}`}
      // Safe: `clean` is the output of the allowlist sanitiser above.
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
