import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Link2,
  Quote,
  RemoveFormatting,
  Heading2,
  Heading3,
} from 'lucide-react';
import { sanitizeHtml } from '../../utils/sanitize.js';

/**
 * The formatting editor behind the admin course content panel.
 *
 * Built on `contentEditable` + `document.execCommand`. execCommand is
 * formally deprecated, but it is still implemented in every current browser
 * and it is the only way to get selection-based rich text editing without
 * pulling in an editor framework (ProseMirror/Slate/TipTap would be a
 * ~100KB dependency for one admin form). The alternative — hand-rolling
 * Range manipulation — is considerably more code and more fragile.
 *
 * Output is sanitised on the way out, so whatever the browser's execCommand
 * produces is normalised to the same allowlist the server enforces.
 */

const FONTS = [
  { value: '', label: 'Default font' },
  { value: 'Inter, sans-serif', label: 'Inter (sans)' },
  { value: 'Georgia, serif', label: 'Georgia (serif)' },
  { value: '"Times New Roman", Times, serif', label: 'Times New Roman' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { value: '"Courier New", monospace', label: 'Courier New' },
  { value: 'Verdana, Geneva, sans-serif', label: 'Verdana' },
];

const SIZES = [
  { value: '', label: 'Normal size' },
  { value: '13px', label: 'Small — 13px' },
  { value: '16px', label: 'Medium — 16px' },
  { value: '18px', label: 'Large — 18px' },
  { value: '22px', label: 'X-Large — 22px' },
  { value: '28px', label: 'Heading — 28px' },
];

/** Toolbar buttons driven straight by execCommand. */
const COMMANDS = [
  { command: 'bold', icon: Bold, label: 'Bold', shortcut: 'Ctrl+B' },
  { command: 'italic', icon: Italic, label: 'Italic', shortcut: 'Ctrl+I' },
  { command: 'underline', icon: Underline, label: 'Underline', shortcut: 'Ctrl+U' },
  { command: 'strikeThrough', icon: Strikethrough, label: 'Strikethrough' },
  { command: 'insertUnorderedList', icon: List, label: 'Bulleted list' },
  { command: 'insertOrderedList', icon: ListOrdered, label: 'Numbered list' },
];

export default function RichTextEditor({
  value = '',
  onChange,
  placeholder = 'Write the course description…',
  label,
  hint,
  minHeight = '12rem',
  id,
}) {
  const editorRef = useRef(null);
  const [active, setActive] = useState({});
  // Tracks what the editor itself last emitted, so the effect below can tell
  // "the parent sent new content" from "this is the echo of my own keystroke"
  // — writing innerHTML on every keystroke would reset the caret to the top.
  const lastEmitted = useRef(value);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (value === lastEmitted.current) return;

    editor.innerHTML = sanitizeHtml(value);
    lastEmitted.current = value;
  }, [value]);

  /** Reflects the caret's current formatting in the toolbar. */
  const syncActive = useCallback(() => {
    if (typeof document === 'undefined') return;
    const next = {};
    for (const { command } of COMMANDS) {
      try {
        next[command] = document.queryCommandState(command);
      } catch {
        next[command] = false;
      }
    }
    setActive(next);
  }, []);

  const emit = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const html = sanitizeHtml(editor.innerHTML);
    lastEmitted.current = html;
    onChange?.(html);
  }, [onChange]);

  /**
   * execCommand applies to the document selection, which is lost the moment
   * a toolbar button takes focus — so every control runs on mousedown with
   * the default prevented, keeping the caret where the admin left it.
   */
  const run = useCallback(
    (command, argument = null) => {
      const editor = editorRef.current;
      if (!editor) return;

      editor.focus();
      try {
        document.execCommand(command, false, argument);
      } catch {
        // A browser that refuses the command leaves the text untouched;
        // nothing useful to tell the admin, so carry on.
      }
      emit();
      syncActive();
    },
    [emit, syncActive]
  );

  /**
   * execCommand('fontSize') only understands the legacy 1–7 scale and emits
   * <font> tags, which the sanitiser drops. So the size control wraps the
   * selection itself and sets a real CSS font-size.
   */
  const applyStyle = useCallback(
    (property, cssValue) => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      if (range.collapsed) return; // nothing selected — nothing to restyle

      const span = document.createElement('span');
      span.style.setProperty(property, cssValue);

      try {
        // surroundContents throws when the selection crosses element
        // boundaries (half of one paragraph into the next); extracting the
        // contents first handles that case.
        span.appendChild(range.extractContents());
        range.insertNode(span);

        // Leave the restyled text selected so the admin can stack another
        // change (font + size) without reselecting.
        selection.removeAllRanges();
        const next = document.createRange();
        next.selectNodeContents(span);
        selection.addRange(next);
      } catch {
        return;
      }

      emit();
    },
    [emit]
  );

  const addLink = useCallback(() => {
    const url = window.prompt('Link URL (https://…)');
    if (!url) return;
    if (!/^(https?:\/\/|mailto:|\/)/i.test(url.trim())) {
      window.alert('Enter a full URL starting with https://, mailto: or /');
      return;
    }
    run('createLink', url.trim());
  }, [run]);

  const onKeyDown = (event) => {
    // The browser handles Ctrl+B/I/U inside contentEditable on its own; this
    // just keeps the toolbar state in step afterwards.
    if ((event.ctrlKey || event.metaKey) && 'biu'.includes(event.key.toLowerCase())) {
      setTimeout(syncActive, 0);
    }
  };

  const isEmpty = !sanitizeHtml(value);

  return (
    <div>
      {label && (
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
      )}

      <div className="overflow-hidden rounded-lg border border-ink-200 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20">
        {/* --- toolbar ------------------------------------------------- */}
        <div className="flex flex-wrap items-center gap-1 border-b border-ink-100 bg-ink-50/70 p-1.5">
          {COMMANDS.map(({ command, icon: Icon, label: commandLabel, shortcut }) => (
            <button
              key={command}
              type="button"
              aria-label={commandLabel}
              aria-pressed={Boolean(active[command])}
              title={shortcut ? `${commandLabel} (${shortcut})` : commandLabel}
              onMouseDown={(event) => {
                event.preventDefault();
                run(command);
              }}
              className={`grid h-8 w-8 place-items-center rounded-md transition ${
                active[command]
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-ink-600 hover:bg-white hover:text-ink-900'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </button>
          ))}

          <span className="mx-1 h-5 w-px bg-ink-200" aria-hidden="true" />

          <button
            type="button"
            aria-label="Heading"
            title="Heading"
            onMouseDown={(event) => {
              event.preventDefault();
              run('formatBlock', '<h2>');
            }}
            className="grid h-8 w-8 place-items-center rounded-md text-ink-600 transition hover:bg-white hover:text-ink-900"
          >
            <Heading2 className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Subheading"
            title="Subheading"
            onMouseDown={(event) => {
              event.preventDefault();
              run('formatBlock', '<h3>');
            }}
            className="grid h-8 w-8 place-items-center rounded-md text-ink-600 transition hover:bg-white hover:text-ink-900"
          >
            <Heading3 className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Quote"
            title="Quote"
            onMouseDown={(event) => {
              event.preventDefault();
              run('formatBlock', '<blockquote>');
            }}
            className="grid h-8 w-8 place-items-center rounded-md text-ink-600 transition hover:bg-white hover:text-ink-900"
          >
            <Quote className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Add link"
            title="Add link"
            onMouseDown={(event) => {
              event.preventDefault();
              addLink();
            }}
            className="grid h-8 w-8 place-items-center rounded-md text-ink-600 transition hover:bg-white hover:text-ink-900"
          >
            <Link2 className="h-4 w-4" aria-hidden="true" />
          </button>

          <span className="mx-1 h-5 w-px bg-ink-200" aria-hidden="true" />

          {/* Font family and size act on the selection, so they reset to
              their placeholder after each use rather than reporting state. */}
          <select
            aria-label="Font style"
            value=""
            onChange={(event) => {
              if (event.target.value) applyStyle('font-family', event.target.value);
              event.target.value = '';
            }}
            className="h-8 rounded-md border border-ink-200 bg-white px-1.5 text-xs text-ink-700 focus:border-primary-500 focus:outline-none"
          >
            {FONTS.map((font) => (
              <option key={font.label} value={font.value}>
                {font.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Font size"
            value=""
            onChange={(event) => {
              if (event.target.value) applyStyle('font-size', event.target.value);
              event.target.value = '';
            }}
            className="h-8 rounded-md border border-ink-200 bg-white px-1.5 text-xs text-ink-700 focus:border-primary-500 focus:outline-none"
          >
            {SIZES.map((size) => (
              <option key={size.label} value={size.value}>
                {size.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            aria-label="Clear formatting"
            title="Clear formatting"
            onMouseDown={(event) => {
              event.preventDefault();
              run('removeFormat');
            }}
            className="ml-auto grid h-8 w-8 place-items-center rounded-md text-ink-600 transition hover:bg-white hover:text-ink-900"
          >
            <RemoveFormatting className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* --- editable surface ---------------------------------------- */}
        <div className="relative">
          {isEmpty && (
            <p className="pointer-events-none absolute left-3.5 top-3 text-sm text-ink-400">
              {placeholder}
            </p>
          )}
          <div
            id={id}
            ref={editorRef}
            role="textbox"
            aria-multiline="true"
            aria-label={label || 'Rich text editor'}
            contentEditable
            suppressContentEditableWarning
            onInput={emit}
            // A paste can carry a whole styled document; routing it through
            // insertText keeps the markup to what the toolbar can produce.
            onPaste={(event) => {
              event.preventDefault();
              const text = event.clipboardData.getData('text/plain');
              run('insertText', text);
            }}
            onKeyUp={syncActive}
            onMouseUp={syncActive}
            onKeyDown={onKeyDown}
            onBlur={emit}
            style={{ minHeight }}
            className="prose-course max-w-none px-3.5 py-3 text-sm text-ink-800 focus:outline-none"
          />
        </div>
      </div>

      {hint && <p className="mt-1.5 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}
