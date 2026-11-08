import { useEffect, useState } from 'react';
import { AlertCircle, CalendarCheck, CheckCircle2, Loader2 } from 'lucide-react';
import Modal from '../common/Modal.jsx';
import { getEnquiryOptions, submitEnquiry, toErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext.jsx';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DIGITS = /^\+?[\d\s()-]{6,20}$/;

/** Shown until the server's list arrives; the server's list is the one it validates against. */
const FALLBACK_STATUSES = ['Student', 'Fresher / job seeker', 'Working professional', 'Career break', 'Business owner / freelancer'];
const FALLBACK_PROGRAM = 'Nationwide Gen AI Program';

const COUNTRY_CODES = ['+91', '+1', '+44', '+61', '+65', '+971', '+966', '+974', '+965', '+968', '+60', '+49'];

const TOPICS = [
  ['Switch Smart', 'How to Transition into Analytics & AI without quitting current job?'],
  ['Crack Internships & Placements', 'How Fresher, career gap, or working professional secure real opportunities?'],
  ['Build a Standout Portfolio', 'How to build Industry-level projects that brings organic job calls?'],
  ["Fix What's Missing", 'Already learned Data Science? Identify the gap blocking your breakthrough.'],
  ['Project under our experts', 'Unlock inbound opportunities by building projects with our expert panel.'],
];

const blank = {
  name: '',
  email: '',
  countryCode: '+91',
  phone: '',
  careerStatus: '',
  designation: '',
  city: '',
  alternatePhone: '',
  message: '',
  website: '',
};

const validNumber = (value) => DIGITS.test(value.trim()) && value.replace(/\D/g, '').length >= 6;

/** Label + control + error, styled to match the popup rather than the dashboard forms. */
function Field({ id, label, required, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[15px] font-semibold text-ink-800">
        {label}
        {required && <span className="ml-1 text-ink-500" aria-hidden="true">*</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

const control = (error, width = 'w-full') =>
  `h-[52px] ${width} rounded-xl border bg-white px-4 text-[15px] text-ink-900 placeholder:text-ink-400 transition focus:outline-none focus:ring-2 ${
    error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : 'border-ink-200 focus:border-primary-500 focus:ring-primary-500/20'
  }`;

/**
 * The homepage "Enroll Now" popup. Responses are saved by the API and copied
 * to the team's Google Sheet; the admin team follows up from Admin → Enquiries.
 */
export default function EnquiryModal({ open, onClose }) {
  const { student } = useAuth();
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [options, setOptions] = useState({ careerStatuses: FALLBACK_STATUSES, program: FALLBACK_PROGRAM });

  // Fresh form each time it opens, prefilled for a signed-in learner.
  useEffect(() => {
    if (!open) return;
    setForm({ ...blank, name: student?.name || '', email: student?.email || '', phone: student?.phone || '', city: student?.city || '' });
    setErrors({});
    setSubmitError('');
    setSent(false);
    getEnquiryOptions()
      .then((data) => setOptions({ careerStatuses: data.careerStatuses?.length ? data.careerStatuses : FALLBACK_STATUSES, program: data.program || FALLBACK_PROGRAM }))
      .catch(() => {});
  }, [open, student]);

  const set = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Enter your full name';
    if (!EMAIL.test(form.email.trim())) next.email = 'Enter a valid email address';
    if (!validNumber(form.phone)) next.phone = 'Enter a valid phone number';
    if (!form.careerStatus) next.careerStatus = 'Select your status';
    if (form.city.trim().length < 2) next.city = 'Enter your location';
    if (!validNumber(form.alternatePhone)) next.alternatePhone = 'Enter a valid alternate number';
    if (form.message.trim().length < 3) next.message = 'Tell us briefly what you expect';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');
    if (!validate()) return;
    setSubmitting(true);
    try {
      // A number typed with its own +code is kept as typed.
      const phone = form.phone.trim().startsWith('+') ? form.phone.trim() : `${form.countryCode} ${form.phone.trim()}`;
      const { countryCode: _code, ...rest } = form;
      await submitEnquiry({ ...rest, phone, program: options.program });
      setSent(true);
    } catch (err) {
      setSubmitError(toErrorMessage(err, 'We could not send your details. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const describe = (key) => (errors[key] ? `enquiry-${key}-error` : undefined);

  return (
    <Modal open={open} onClose={onClose} label="Enroll in the Nationwide Gen AI Program" panelClassName="max-w-6xl p-0">
      <div className="h-1.5 bg-gradient-to-r from-primary-800 via-primary-600 to-primary-400" aria-hidden="true" />

      <div className="grid md:grid-cols-[minmax(0,46%)_minmax(0,1fr)]">
        {/* --- left: what the program / call is about ------------------- */}
        <aside className="border-b border-ink-100 bg-slate-50 px-6 py-8 text-center sm:px-10 md:border-b-0 md:border-r md:py-10">
          <h2 className="font-['Sora',sans-serif] text-[26px] font-extrabold leading-snug text-ink-950 sm:text-[34px]">
            Enroll{' '}
            <span className="inline-block rounded-md bg-primary-600 px-3 py-0.5 text-white">Nationwide</span>
            <br />
            Gen AI Program
          </h2>
          <p className="mx-auto mt-6 max-w-md text-[15px] leading-7 text-ink-600">
            Clarify all your doubts with our Data Experts Panel who empowered{' '}
            <strong className="font-semibold text-ink-800">1000+ aspirants worldwide</strong> to build successful careers in Data
            Analytics and AI across 11+ industries.
          </p>

          <div className="mt-8 hidden border-t border-ink-200 pt-8 text-left md:block">
            <p className="text-center text-sm font-medium uppercase tracking-[0.18em] text-ink-500">What you can discuss?</p>
            <ol className="mt-6 space-y-5">
              {TOPICS.map(([head, body], index) => (
                <li key={head} className="flex gap-4">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-[3px] border-2 border-ink-900 bg-primary-600 text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <p className="text-[15.5px] leading-7 text-ink-600">
                    <strong className="font-semibold text-ink-900">{head} –</strong> {body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </aside>

        {/* --- right: the form ------------------------------------------ */}
        <section className="px-6 py-8 sm:px-10 md:py-12">
          {sent ? (
            <div className="flex h-full flex-col items-center justify-center py-10 text-center">
              <CheckCircle2 className="h-14 w-14 text-emerald-500" aria-hidden="true" />
              <h3 className="mt-4 font-['Sora',sans-serif] text-2xl font-bold text-ink-950">You're booked in!</h3>
              <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-ink-600">
                Thanks, {form.name.split(' ')[0]}. Our team will reach out on{' '}
                <strong className="font-semibold text-ink-900">{form.phone.trim().startsWith('+') ? form.phone : `${form.countryCode} ${form.phone}`}</strong>{' '}
                within 24 hours.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-6 rounded-lg bg-primary-600 px-8 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-primary-700"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <h3 className="font-['Sora',sans-serif] text-2xl font-extrabold text-ink-950">Book Your Session</h3>
              <p className="mt-1.5 text-[15px] text-ink-600">Fill in your details — our team will reach out within 24 hours</p>

              <form onSubmit={onSubmit} noValidate className="mt-7">
                {submitError && (
                  <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    {submitError}
                  </div>
                )}

                <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                  <Field id="enquiry-name" label="Name" required error={errors.name}>
                    <input id="enquiry-name" className={control(errors.name)} autoComplete="name" maxLength={80} placeholder="Your full name" value={form.name} onChange={set('name')} aria-invalid={Boolean(errors.name)} aria-describedby={describe('name')} />
                  </Field>
                  <Field id="enquiry-email" label="Email" required error={errors.email}>
                    <input id="enquiry-email" type="email" className={control(errors.email)} autoComplete="email" maxLength={120} placeholder="your@email.com" value={form.email} onChange={set('email')} aria-invalid={Boolean(errors.email)} aria-describedby={describe('email')} />
                  </Field>

                  <Field id="enquiry-phone" label="Phone" required error={errors.phone}>
                    <div className="flex gap-3">
                      <select aria-label="Country code" className={`${control(undefined, 'w-[6.5rem]')} shrink-0 !px-3`} value={form.countryCode} onChange={set('countryCode')}>
                        {COUNTRY_CODES.map((code) => (
                          <option key={code} value={code}>{code}</option>
                        ))}
                      </select>
                      <input id="enquiry-phone" type="tel" className={control(errors.phone, 'min-w-0 flex-1')} autoComplete="tel-national" maxLength={15} placeholder="98765 43210" value={form.phone} onChange={set('phone')} aria-invalid={Boolean(errors.phone)} aria-describedby={describe('phone')} />
                    </div>
                  </Field>
                  <Field id="enquiry-status" label="Status" required error={errors.careerStatus}>
                    <select id="enquiry-status" className={control(errors.careerStatus)} value={form.careerStatus} onChange={set('careerStatus')} aria-invalid={Boolean(errors.careerStatus)} aria-describedby={describe('careerStatus')}>
                      <option value="">Select your status</option>
                      {options.careerStatuses.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </Field>

                  <Field id="enquiry-designation" label="Designation">
                    <input id="enquiry-designation" className={control()} autoComplete="organization-title" maxLength={100} placeholder="Current designation" value={form.designation} onChange={set('designation')} />
                  </Field>
                  <Field id="enquiry-city" label="Location" required error={errors.city}>
                    <input id="enquiry-city" className={control(errors.city)} autoComplete="address-level2" maxLength={80} placeholder="City, Country" value={form.city} onChange={set('city')} aria-invalid={Boolean(errors.city)} aria-describedby={describe('city')} />
                  </Field>

                  <Field id="enquiry-alt" label="Alternative Number" required error={errors.alternatePhone}>
                    <input id="enquiry-alt" type="tel" className={control(errors.alternatePhone)} maxLength={15} placeholder="Alternate number" value={form.alternatePhone} onChange={set('alternatePhone')} aria-invalid={Boolean(errors.alternatePhone)} aria-describedby={describe('alternatePhone')} />
                  </Field>
                  <Field id="enquiry-summary" label="Brief Profile Summary" required error={errors.message}>
                    <input id="enquiry-summary" className={control(errors.message)} maxLength={1000} placeholder="Your expectation" value={form.message} onChange={set('message')} aria-invalid={Boolean(errors.message)} aria-describedby={describe('message')} />
                  </Field>
                </div>

                {/* Honeypot: hidden from people, filled in by bots. */}
                <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
                  <label htmlFor="enquiry-website">Website</label>
                  <input id="enquiry-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-7 inline-flex h-12 min-w-[150px] items-center justify-center gap-2 rounded-lg bg-primary-600 px-8 text-[15px] font-semibold text-white shadow-[0_8px_20px_-6px_rgba(36,80,235,0.6)] transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CalendarCheck className="h-4 w-4" aria-hidden="true" />}
                  {submitting ? 'Booking…' : 'Book'}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </Modal>
  );
}
