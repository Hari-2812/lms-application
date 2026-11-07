import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Mail, MapPin, Phone, Send, User } from 'lucide-react';
import Modal from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import Input from '../common/Input.jsx';
import { getCourses, submitEnquiry, toErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext.jsx';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s()-]{7,20}$/;
const NOT_SURE = 'Not sure yet — help me choose';

const blank = { name: '', email: '', phone: '', program: '', city: '', message: '', website: '' };

/**
 * The homepage "Enroll Now" form. Responses are saved by the API and copied
 * to the team's Google Sheet; the admin team follows up from Admin → Enquiries.
 */
export default function EnquiryModal({ open, onClose }) {
  const { student } = useAuth();
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [programs, setPrograms] = useState([]);

  // Fresh form each time it opens, prefilled for a signed-in learner.
  useEffect(() => {
    if (!open) return;
    setForm({ ...blank, name: student?.name || '', email: student?.email || '', phone: student?.phone || '', city: student?.city || '' });
    setErrors({});
    setSubmitError('');
    setSent(false);
    getCourses()
      .then((courses) => setPrograms(courses.filter((c) => c.published !== false).map((c) => c.title)))
      .catch(() => setPrograms([]));
  }, [open, student]);

  const set = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Enter your full name';
    if (!EMAIL.test(form.email.trim())) next.email = 'Enter a valid email address';
    if (!PHONE.test(form.phone.trim()) || form.phone.replace(/\D/g, '').length < 7) next.phone = 'Enter a valid phone number';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');
    if (!validate()) return;
    setSubmitting(true);
    try {
      await submitEnquiry(form);
      setSent(true);
    } catch (err) {
      setSubmitError(toErrorMessage(err, 'We could not send your enquiry. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={sent ? 'Thank you!' : 'Enroll now'}
      description={sent ? undefined : 'Tell us a little about yourself and our team will call you back about the right program.'}
    >
      {sent ? (
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" aria-hidden="true" />
          <p className="mt-3 text-sm leading-relaxed text-ink-600">
            We have your details, {form.name.split(' ')[0]}. Someone from the Analytics Avenue team will contact you on{' '}
            <strong className="font-semibold text-ink-900">{form.phone}</strong> shortly.
          </p>
          <Button className="mt-6" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="-mr-2 max-h-[65vh] space-y-4 overflow-y-auto pr-2">
          {submitError && (
            <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {submitError}
            </div>
          )}

          <Input label="Full name" icon={User} autoComplete="name" value={form.name} onChange={set('name')} error={errors.name} maxLength={80} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Email" type="email" icon={Mail} autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} maxLength={120} required />
            <Input label="Phone" type="tel" icon={Phone} autoComplete="tel" value={form.phone} onChange={set('phone')} error={errors.phone} maxLength={20} placeholder="+91 98765 43210" required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="enquiry-program">Program of interest</label>
              <select id="enquiry-program" className="field-input" value={form.program} onChange={set('program')}>
                <option value="">Choose a program…</option>
                {programs.map((title) => (
                  <option key={title} value={title}>{title}</option>
                ))}
                <option value={NOT_SURE}>{NOT_SURE}</option>
              </select>
            </div>
            <Input label="City" icon={MapPin} autoComplete="address-level2" value={form.city} onChange={set('city')} maxLength={80} />
          </div>
          <div>
            <label className="field-label" htmlFor="enquiry-message">Anything we should know? (optional)</label>
            <textarea
              id="enquiry-message"
              className="field-input min-h-[80px] resize-y"
              maxLength={1000}
              value={form.message}
              onChange={set('message')}
              placeholder="Your background, preferred batch timing, questions…"
            />
          </div>

          {/* Honeypot: hidden from people, filled in by bots. */}
          <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
            <label htmlFor="enquiry-website">Website</label>
            <input id="enquiry-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
          </div>

          <Button type="submit" size="lg" fullWidth loading={submitting}>
            {!submitting && <Send className="h-4 w-4" aria-hidden="true" />}
            {submitting ? 'Sending…' : 'Submit enquiry'}
          </Button>
        </form>
      )}
    </Modal>
  );
}
