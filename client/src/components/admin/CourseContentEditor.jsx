import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BadgeIndianRupee,
  Check,
  Eye,
  FileText,
  Image as ImageIcon,
  ListChecks,
  Loader2,
  Save,
  Trash2,
  Upload,
  Video,
} from 'lucide-react';
import Badge from '../common/Badge.jsx';
import Button from '../common/Button.jsx';
import Input from '../common/Input.jsx';
import RichText from '../common/RichText.jsx';
import RichTextEditor from '../common/RichTextEditor.jsx';
import CourseThumbnail from '../courses/CourseThumbnail.jsx';
import { deleteCourseImage, resolveMediaUrl, toErrorMessage, uploadCourseImage } from '../../api/client';
import { formatPrice } from '../../utils/course.js';
import { hasRichText } from '../../utils/sanitize.js';

/**
 * Admin editor for everything the Browse Courses catalogue and the course
 * details page show: artwork, intro video, the formatted summary and
 * description, and the package/pricing details.
 *
 * Saving sends only the fields in this panel, so it never clobbers whatever
 * the other admin panels own (lessons, resources, access grants) — see the
 * allowlist in server/src/controllers/adminController.js.
 */

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const ACCENTS = ['sky', 'emerald', 'violet', 'amber', 'rose'];

const PANELS = [
  { value: 'content', label: 'Content', icon: FileText },
  { value: 'media', label: 'Media', icon: ImageIcon },
  { value: 'package', label: 'Package & pricing', icon: BadgeIndianRupee },
  { value: 'details', label: 'Learning details', icon: ListChecks },
];

/** A bullet list edited as one-per-line text. */
const listToText = (list) => (Array.isArray(list) ? list.join('\n') : '');
const textToList = (text) =>
  String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

/** The editable shape, built from whatever the API returned. */
function toForm(course) {
  return {
    title: course.title || '',
    slug: course.slug || '',
    summary: course.summary || '',
    description: course.description || '',
    descriptionHtml: course.descriptionHtml || '',
    thumbnail: course.thumbnail || '',
    introVideoUrl: course.introVideoUrl || '',
    accent: course.accent || 'sky',
    category: course.category || '',
    level: course.level || 'Beginner',
    instructor: course.instructor || '',
    instructorTitle: course.instructorTitle || '',
    language: course.language || '',
    hours: course.hours ?? '',
    price: course.price ?? '',
    originalPrice: course.originalPrice ?? '',
    features: listToText(course.features),
    outcomes: listToText(course.outcomes),
    requirements: listToText(course.requirements),
    certificateIncluded: course.certificateIncluded !== false,
    published: course.published !== false,
  };
}

export default function CourseContentEditor({ course, onSave, onSaved }) {
  const [panel, setPanel] = useState('content');
  const [form, setForm] = useState(() => toForm(course));
  const [notifyStudents, setNotifyStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState(null);
  const [previewing, setPreviewing] = useState(false);

  // Re-seed when the admin switches to a different course row.
  useEffect(() => {
    setForm(toForm(course));
    setError('');
    setSavedAt(null);
  }, [course._id]);

  const set = (key) => (event) => {
    const target = event?.target;
    const value = target?.type === 'checkbox' ? target.checked : target?.value;
    setForm((prev) => ({ ...prev, [key]: value }));
    setSavedAt(null);
  };

  const original = useMemo(() => toForm(course), [course]);

  /**
   * Compared as strings because a number input hands back `"14"` while the
   * saved course holds `14` — a strict comparison would leave the form
   * looking unsaved forever after the first successful save.
   */
  const dirty = useMemo(
    () => Object.keys(form).some((key) => String(form[key]) !== String(original[key])),
    [form, original]
  );

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = {
        ...form,
        // Numbers come out of <input type="number"> as strings; empty means
        // "leave unset" rather than zero.
        hours: form.hours === '' ? 0 : Number(form.hours),
        price: form.price === '' ? 0 : Number(form.price),
        originalPrice: form.originalPrice === '' ? 0 : Number(form.originalPrice),
        features: textToList(form.features),
        outcomes: textToList(form.outcomes),
        requirements: textToList(form.requirements),
        notifyStudents,
      };

      await onSave(course._id, payload);
      setSavedAt(Date.now());
      setNotifyStudents(false);
      onSaved?.();
    } catch (err) {
      setError(err?.message || 'Could not save the course.');
    } finally {
      setSaving(false);
    }
  };

  // What CourseThumbnail/CourseDetails will be handed once this is saved.
  const previewCourse = {
    ...course,
    ...form,
    price: form.price === '' ? 0 : Number(form.price),
    originalPrice: form.originalPrice === '' ? 0 : Number(form.originalPrice),
    features: textToList(form.features),
  };

  return (
    <form onSubmit={handleSave} className="rounded-xl border border-ink-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-ink-900">Course content</h4>
          {form.published ? (
            <Badge tone="success">Published</Badge>
          ) : (
            <Badge tone="neutral">Draft</Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setPreviewing((v) => !v)}
            aria-pressed={previewing}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            {previewing ? 'Hide preview' : 'Preview'}
          </Button>
          {savedAt && !dirty && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Saved
            </span>
          )}
          <Button type="submit" size="sm" loading={saving} disabled={saving || !dirty}>
            <Save className="h-4 w-4" aria-hidden="true" />
            Save changes
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 border-b border-red-100 bg-red-50 px-4 py-2.5 text-[13px] text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {/* --- panel switcher ------------------------------------------- */}
      <div className="flex flex-wrap gap-1 border-b border-ink-100 px-3 py-2">
        {PANELS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setPanel(value)}
            aria-pressed={panel === value}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${
              panel === value
                ? 'bg-primary-50 text-primary-700'
                : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-5 p-4">
        {/* ---------- Content ---------------------------------------- */}
        {panel === 'content' && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Course title" value={form.title} onChange={set('title')} required />
              <Input
                label="URL slug"
                value={form.slug}
                onChange={set('slug')}
                hint="Used in the course's public address."
                required
              />
            </div>

            <div>
              <label className="field-label" htmlFor={`summary-${course._id}`}>
                Short summary
              </label>
              <textarea
                id={`summary-${course._id}`}
                className="field-input min-h-[60px] resize-y"
                value={form.summary}
                onChange={set('summary')}
                maxLength={240}
                placeholder="One line that sells the course — shown on the package header."
              />
              <p className="mt-1.5 text-xs text-ink-500">
                {form.summary.length}/240 characters.
              </p>
            </div>

            <div>
              <label className="field-label" htmlFor={`description-${course._id}`}>
                Card description
              </label>
              <textarea
                id={`description-${course._id}`}
                className="field-input min-h-[80px] resize-y"
                value={form.description}
                onChange={set('description')}
                placeholder="Plain-text blurb shown on the course cards in Browse Courses."
              />
            </div>

            <RichTextEditor
              id={`description-html-${course._id}`}
              label="Full description (formatted)"
              value={form.descriptionHtml}
              onChange={(html) => {
                setForm((prev) => ({ ...prev, descriptionHtml: html }));
                setSavedAt(null);
              }}
              hint="Bold, italic, underline, headings, lists, font style and font size. This is what students read on the course details page."
              placeholder="Describe the course in full…"
              minHeight="14rem"
            />
          </>
        )}

        {/* ---------- Media ----------------------------------------- */}
        {panel === 'media' && (
          <>
            <div className="grid gap-5 sm:grid-cols-[1fr_16rem]">
              <div className="space-y-4">
                <ThumbnailUpload
                  courseId={course._id}
                  value={form.thumbnail}
                  onChange={(url) => {
                    setForm((prev) => ({ ...prev, thumbnail: url }));
                    setSavedAt(null);
                  }}
                />

                <Input
                  label="…or paste an image URL"
                  value={form.thumbnail}
                  onChange={set('thumbnail')}
                  placeholder="https://…/course-cover.jpg"
                  hint="Leave empty to use the generated artwork below."
                />

                <div>
                  <label className="field-label" htmlFor={`accent-${course._id}`}>
                    Generated artwork colour
                  </label>
                  <select
                    id={`accent-${course._id}`}
                    className="field-input"
                    value={form.accent}
                    onChange={set('accent')}
                  >
                    {ACCENTS.map((accent) => (
                      <option key={accent} value={accent}>
                        {accent.charAt(0).toUpperCase() + accent.slice(1)}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-ink-500">
                    Used when no thumbnail URL is set.
                  </p>
                </div>
              </div>

              <div>
                <p className="field-label">Preview</p>
                <div className="relative aspect-[16/9] overflow-hidden rounded-lg border border-ink-100 bg-ink-100">
                  <CourseThumbnail course={previewCourse} />
                </div>
              </div>
            </div>

            <Input
              label="Intro / preview video URL"
              icon={Video}
              value={form.introVideoUrl}
              onChange={set('introVideoUrl')}
              placeholder="https://www.youtube.com/watch?v=… or a direct .mp4 URL"
              hint="Shown on the course details page before a student enrols. Lesson videos stay private and are added through 'Add Drive lesson'."
            />

            <div className="rounded-lg bg-surface-muted p-3.5 text-[13px] leading-relaxed text-ink-600">
              <strong className="font-semibold text-ink-800">Why the intro video is different.</strong>{' '}
              An intro is public marketing, so a plain shareable URL is fine. Lesson videos are
              streamed through the API from private storage and never expose a link — add those
              with the Drive lesson form.
            </div>
          </>
        )}

        {/* ---------- Package & pricing ----------------------------- */}
        {panel === 'package' && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="Price (₹)"
                type="number"
                min="0"
                value={form.price}
                onChange={set('price')}
                hint="0 shows as Free."
              />
              <Input
                label="Original price (₹)"
                type="number"
                min="0"
                value={form.originalPrice}
                onChange={set('originalPrice')}
                hint="Struck through when higher than the price."
              />
              <Input
                label="Duration (hours)"
                type="number"
                min="0"
                step="0.5"
                value={form.hours}
                onChange={set('hours')}
              />
            </div>

            <div>
              <label className="field-label" htmlFor={`features-${course._id}`}>
                What the package includes
              </label>
              <textarea
                id={`features-${course._id}`}
                className="field-input min-h-[140px] resize-y font-mono text-[13px]"
                value={form.features}
                onChange={set('features')}
                placeholder={'Lifetime access to all lessons\nDownloadable study material\nCertificate of completion\nDoubt-clearing sessions'}
              />
              <p className="mt-1.5 text-xs text-ink-500">
                One benefit per line. These are the ticked items on the course details page.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex items-start gap-3 rounded-lg border border-ink-200 p-3.5">
                <input
                  type="checkbox"
                  checked={form.certificateIncluded}
                  onChange={set('certificateIncluded')}
                  className="mt-0.5 h-4 w-4 rounded border-ink-300 text-primary-600 focus:ring-primary-500/30"
                />
                <span>
                  <span className="block text-sm font-medium text-ink-900">
                    Includes a certificate
                  </span>
                  <span className="block text-xs text-ink-500">
                    Generated automatically when a student finishes every lesson.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-lg border border-ink-200 p-3.5">
                <input
                  type="checkbox"
                  checked={form.published}
                  onChange={set('published')}
                  className="mt-0.5 h-4 w-4 rounded border-ink-300 text-primary-600 focus:ring-primary-500/30"
                />
                <span>
                  <span className="block text-sm font-medium text-ink-900">Published</span>
                  <span className="block text-xs text-ink-500">
                    Unpublished courses stay hidden from Browse Courses.
                  </span>
                </span>
              </label>
            </div>
          </>
        )}

        {/* ---------- Learning details ------------------------------ */}
        {panel === 'details' && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Category" value={form.category} onChange={set('category')} placeholder="e.g. Data Analytics" />
              <div>
                <label className="field-label" htmlFor={`level-${course._id}`}>
                  Level
                </label>
                <select id={`level-${course._id}`} className="field-input" value={form.level} onChange={set('level')}>
                  {LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>
              <Input label="Instructor" value={form.instructor} onChange={set('instructor')} />
              <Input
                label="Instructor title"
                value={form.instructorTitle}
                onChange={set('instructorTitle')}
                placeholder="e.g. Lead Data Scientist"
              />
              <Input
                label="Language"
                value={form.language}
                onChange={set('language')}
                placeholder="e.g. Tamil"
              />
            </div>

            <div>
              <label className="field-label" htmlFor={`outcomes-${course._id}`}>
                What students will learn
              </label>
              <textarea
                id={`outcomes-${course._id}`}
                className="field-input min-h-[120px] resize-y font-mono text-[13px]"
                value={form.outcomes}
                onChange={set('outcomes')}
                placeholder={'Build dashboards in Power BI\nWrite SQL joins with confidence'}
              />
              <p className="mt-1.5 text-xs text-ink-500">One outcome per line.</p>
            </div>

            <div>
              <label className="field-label" htmlFor={`requirements-${course._id}`}>
                Requirements
              </label>
              <textarea
                id={`requirements-${course._id}`}
                className="field-input min-h-[100px] resize-y font-mono text-[13px]"
                value={form.requirements}
                onChange={set('requirements')}
                placeholder={'A laptop with 8GB RAM\nBasic spreadsheet knowledge'}
              />
              <p className="mt-1.5 text-xs text-ink-500">One requirement per line.</p>
            </div>
          </>
        )}

        {/* ---------- Student-facing preview ------------------------ */}
        {previewing && (
          <section className="rounded-lg border border-dashed border-primary-200 bg-primary-50/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">
              How students will see this
            </p>

            <h5 className="mt-3 text-base font-semibold text-ink-900">{form.title || 'Untitled course'}</h5>
            {form.summary && <p className="mt-1 text-[13px] text-ink-600">{form.summary}</p>}

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-600">
              <Badge tone="primary">{formatPrice(previewCourse.price)}</Badge>
              {form.category && <Badge tone="neutral">{form.category}</Badge>}
              <Badge tone="neutral">{form.level}</Badge>
              {form.hours !== '' && Number(form.hours) > 0 && (
                <Badge tone="neutral">{form.hours}h</Badge>
              )}
            </div>

            {hasRichText(form.descriptionHtml) ? (
              <div className="mt-4 rounded-lg bg-white p-3.5">
                <RichText html={form.descriptionHtml} />
              </div>
            ) : (
              <p className="mt-4 text-[13px] italic text-ink-500">
                No formatted description yet — the plain card description will be shown instead.
              </p>
            )}

            {textToList(form.features).length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {textToList(form.features).map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-[13px] text-ink-700">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* ---------- Save bar -------------------------------------- */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
          <label className="flex items-center gap-2.5 text-[13px] text-ink-700">
            <input
              type="checkbox"
              checked={notifyStudents}
              onChange={(event) => setNotifyStudents(event.target.checked)}
              className="h-4 w-4 rounded border-ink-300 text-primary-600 focus:ring-primary-500/30"
            />
            Notify enrolled students about this update
          </label>

          <Button type="submit" size="sm" loading={saving} disabled={saving || !dirty}>
            <Save className="h-4 w-4" aria-hidden="true" />
            {dirty ? 'Save changes' : 'No changes'}
          </Button>
        </div>
      </div>
    </form>
  );
}

/**
 * Thumbnail picker: upload a file from the admin's machine, or keep using a
 * pasted URL. On success the course's `thumbnail` becomes the path the API
 * serves the file at, so the two inputs write to the same field.
 *
 * Replacing an uploaded image deletes the previous file, so repeated edits
 * do not fill the disk with orphans. A pasted URL is never deleted — it is
 * not ours to remove.
 */
function ThumbnailUpload({ courseId, value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  // The saved image could not be loaded — e.g. one uploaded before images were
  // kept in the database, which the host's disk wipe has since removed.
  const [missing, setMissing] = useState(false);

  useEffect(() => setMissing(false), [value]);

  const isUploaded = typeof value === 'string' && value.startsWith('/uploads/');

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    // Let the same file be chosen again after a failure.
    event.target.value = '';
    if (!file) return;

    setError('');
    setUploading(true);
    setProgress(0);

    const previous = value;

    try {
      const result = await uploadCourseImage(file, setProgress);
      onChange(result.url);

      // Clean up the file this one replaced, now that the new one is in hand.
      if (previous?.startsWith('/uploads/thumbnails/')) {
        deleteCourseImage(previous.split('/').pop()).catch(() => {});
      }
    } catch (err) {
      setError(toErrorMessage(err, 'Could not upload that image.'));
    } finally {
      setUploading(false);
    }
  };

  const clear = () => {
    if (isUploaded) deleteCourseImage(value.split('/').pop()).catch(() => {});
    onChange('');
  };

  return (
    <div>
      <span className="field-label">Thumbnail image</span>

      <div className="flex flex-wrap items-center gap-2.5">
        <label
          className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-ink-200 bg-white
                      px-3.5 py-2 text-[13px] font-semibold text-ink-700 transition hover:bg-ink-50
                      ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="h-4 w-4" aria-hidden="true" />
          )}
          {uploading ? `Uploading ${progress}%` : 'Upload image'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={handleFile}
            disabled={uploading}
          />
        </label>

        {value && (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] font-medium
                       text-ink-500 transition hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Remove
          </button>
        )}
      </div>

      <p className="mt-1.5 text-xs text-ink-500">
        JPG, PNG, WebP or GIF, up to 5 MB.{' '}
        {isUploaded ? 'Stored on the server.' : 'Or paste a link below.'}
      </p>

      {error && <p className="field-error">{error}</p>}

      {missing && (
        <p className="field-error">
          This image can no longer be found on the server. Upload it again and save the course.
        </p>
      )}

      {/* Shows the actual served file, so a broken path is obvious here
          rather than after saving. */}
      {value && !missing && (
        <img
          src={resolveMediaUrl(value)}
          alt=""
          className="mt-3 h-24 w-auto rounded-lg border border-ink-100 object-cover"
          onError={() => setMissing(true)}
        />
      )}
    </div>
  );
}
