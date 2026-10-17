import { useEffect, useRef, useState } from 'react';
import { Bell, CreditCard, ImagePlus, Mail, Palette, Save, Send, Settings } from 'lucide-react';
import {
  API_ORIGIN,
  getAdminSettings,
  resolveMediaUrl,
  sendTestEmail,
  toErrorMessage,
  updateAdminSettings,
  uploadCourseImage,
} from '../../api/client';
import { usePageMeta } from '../../components/layout/DashboardLayout.jsx';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import { useBranding } from '../../context/BrandingContext.jsx';
import { AdminTabs, Alert, LoadingRow, PageHeader, Panel, Pill, Toggle, useFlash } from '../../components/admin/ui.jsx';

/**
 * Admin → LMS settings: branding, payment gateway, email and notification
 * switches. Each tab saves only its own section.
 */

const TABS = [
  { value: 'branding', label: 'Branding', icon: Palette },
  { value: 'payments', label: 'Payment gateway', icon: CreditCard },
  { value: 'email', label: 'Email & notifications', icon: Mail },
];

const ADMIN_EVENTS = [
  ['learnerRegistered', 'New learner registered'],
  ['paymentReceived', 'Payment received'],
  ['paymentPending', 'Payment pending'],
  ['paymentFailed', 'Payment failed'],
  ['taskSubmitted', 'Task submitted and awaiting review'],
  ['learnerEnrolled', 'Learner enrolled in a course'],
  ['certificateIssued', 'Certificate issued'],
];

const LEARNER_EVENTS = [
  ['newCourse', 'New course added or published'],
  ['newTask', 'New task or assignment, with its due date'],
  ['taskReviewed', 'Task reviewed — feedback and score available'],
  ['newEvent', 'New event or session added'],
  ['paymentConfirmed', 'Payment successful and enrolment confirmed'],
  ['certificateReady', 'Certificate generated and ready to download'],
];

export default function AdminSettings() {
  const { refresh: refreshBranding } = useBranding();
  const flash = useFlash();
  const [tab, setTab] = useState('branding');
  const [settings, setSettings] = useState(null);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [uploading, setUploading] = useState(0);
  const fileRef = useRef(null);

  usePageMeta('LMS settings', 'Branding, payments, email and notifications.');

  useEffect(() => {
    getAdminSettings()
      .then((data) => {
        setSettings(data.settings);
        setEmailConfigured(data.emailConfigured);
      })
      .catch((err) => flash.error(toErrorMessage(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  if (!settings) {
    return (
      <div className="space-y-6">
        <PageHeader icon={Settings} title="LMS settings" />
        {flash.node || <div className="admin-card"><LoadingRow label="Loading settings…" /></div>}
      </div>
    );
  }

  const set = (section, key) => (value) =>
    setSettings((prev) => ({ ...prev, [section]: { ...prev[section], [key]: value } }));
  const field = (section, key) => (event) => set(section, key)(event.target.value);
  const setNotification = (audience, key) => (value) =>
    setSettings((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, [audience]: { ...prev.notifications[audience], [key]: value } },
    }));

  const save = async (sections) => {
    setSaving(true);
    try {
      const patch = Object.fromEntries(sections.map((s) => [s, settings[s]]));
      const data = await updateAdminSettings(patch);
      setSettings(data.settings);
      setEmailConfigured(data.emailConfigured);
      refreshBranding();
      flash.success('Settings saved.');
    } catch (err) {
      flash.error(toErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const onLogo = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const result = await uploadCourseImage(file, setUploading);
      set('branding', 'logoUrl')(result.url);
    } catch (err) {
      flash.error(toErrorMessage(err));
    } finally {
      setUploading(0);
    }
  };

  const onTestEmail = async () => {
    setTesting(true);
    try {
      const result = await sendTestEmail();
      flash.success(result.message);
    } catch (err) {
      flash.error(toErrorMessage(err));
    } finally {
      setTesting(false);
    }
  };

  const { branding, certificate, payments, email, notifications } = settings;
  const webhookUrl = `${API_ORIGIN || window.location.origin}/api/payments/webhook/razorpay`;
  const keyMode = payments.razorpayKeyId.startsWith('rzp_live_') ? 'Live' : payments.razorpayKeyId.startsWith('rzp_test_') ? 'Test' : null;

  const saveButton = (sections) => (
    <div className="flex justify-end border-t border-ink-100 pt-5">
      <Button onClick={() => save(sections)} loading={saving}>
        <Save className="h-4 w-4" aria-hidden="true" />
        Save changes
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Settings}
        title="LMS settings"
        description="Changes apply across the platform as soon as they are saved, and every save is recorded in the activity log."
      />

      <AdminTabs tabs={TABS} value={tab} onChange={setTab} />
      {flash.node}

      {/* --- branding ------------------------------------------------------ */}
      {tab === 'branding' && (
        <Panel icon={Palette} title="Platform name, logo and branding" description="Shown in the sidebar, sign-in pages, emails and on certificates.">
          <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Platform name" value={branding.platformName} maxLength={60} onChange={field('branding', 'platformName')} />
              <Input label="Tagline" value={branding.tagline} maxLength={60} onChange={field('branding', 'tagline')} hint="Shown under the name, e.g. EduTech." />
              <Input label="Support email" type="email" value={branding.supportEmail} onChange={field('branding', 'supportEmail')} />
              <Input label="Logo URL" value={branding.logoUrl} onChange={field('branding', 'logoUrl')} placeholder="Upload or paste a link" />
            </div>

            <div className="rounded-xl bg-primary-800 p-5 text-center">
              <p className="text-[12px] text-primary-200">Preview</p>
              <div className="mx-auto mt-4 grid h-16 w-16 place-items-center overflow-hidden rounded-xl bg-white">
                <img src={branding.logoUrl ? resolveMediaUrl(branding.logoUrl) : '/logos/logo-new.png'} alt="" className="h-12 w-auto object-contain" />
              </div>
              <p className="mt-3 text-base font-bold text-white">{branding.platformName || 'Platform name'}</p>
              <p className="text-[12px] text-primary-200">{branding.tagline}</p>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onLogo} />
              <Button size="sm" variant="inverse" className="mt-4" loading={uploading > 0} onClick={() => fileRef.current?.click()}>
                <ImagePlus className="h-4 w-4" aria-hidden="true" />
                {uploading ? `Uploading ${uploading}%` : 'Upload logo'}
              </Button>
            </div>
          </div>
          <div className="mt-6">{saveButton(['branding'])}</div>
        </Panel>
      )}

      {tab === 'branding' && (
        <Panel
          title="Certificate template"
          description="The fixed text on every certificate. Learner name, course name and month & year are filled in automatically."
          actions={
            <Button to="/admin/certificates" size="sm" variant="secondary">
              Preview certificate
            </Button>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Company" value={certificate.companyName} maxLength={60} onChange={field('certificate', 'companyName')} />
            <Input label="Tagline" value={certificate.tagline} maxLength={80} onChange={field('certificate', 'tagline')} />
            <Input
              label="Certificate title"
              value={certificate.title}
              maxLength={60}
              onChange={field('certificate', 'title')}
              hint="The last word is printed on its own line, e.g. CERTIFICATE."
            />
            <Input label="Issued by — name" value={certificate.issuerName} maxLength={60} onChange={field('certificate', 'issuerName')} />
            <Input label="Issued by — title" value={certificate.issuerTitle} maxLength={60} onChange={field('certificate', 'issuerTitle')} />
            <Input label="Issued by — role" value={certificate.issuerRole} maxLength={60} onChange={field('certificate', 'issuerRole')} />
          </div>
          <div className="mt-6">{saveButton(['certificate'])}</div>
        </Panel>
      )}

      {/* --- payments ------------------------------------------------------ */}
      {tab === 'payments' && (
        <Panel icon={CreditCard} title="Payment gateway configuration" description="How learners pay for courses.">
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="field-label">Gateway</legend>
            {[
              ['manual', 'Manual (UPI / bank transfer)', 'Learners pay you directly; you mark each payment as received.'],
              ['razorpay', 'Razorpay', 'Cards, UPI and net banking online. Verified payments enrol learners automatically.'],
            ].map(([value, label, hint]) => (
              <label
                key={value}
                className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${
                  payments.gateway === value ? 'border-primary-500 bg-primary-50/60' : 'border-ink-200 hover:border-ink-300'
                }`}
              >
                <input type="radio" name="gateway" className="mt-0.5 h-4 w-4 text-primary-600" checked={payments.gateway === value} onChange={() => set('payments', 'gateway')(value)} />
                <span>
                  <span className="block text-sm font-semibold text-ink-900">{label}</span>
                  <span className="block text-[12.5px] text-ink-500">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {payments.gateway === 'razorpay' && (
            <div className="mt-6 grid gap-4 rounded-2xl border border-ink-200 bg-ink-50/50 p-5 sm:grid-cols-2">
              <div className="flex items-center gap-2 sm:col-span-2">
                <p className="text-sm font-semibold text-ink-900">Razorpay keys</p>
                {keyMode && <Pill tone={keyMode === 'Live' ? 'green' : 'amber'}>{keyMode} mode</Pill>}
              </div>
              <Input label="Key ID" value={payments.razorpayKeyId} onChange={field('payments', 'razorpayKeyId')} placeholder="rzp_test_…" />
              <Input
                label="Key secret"
                type="password"
                value={payments.razorpayKeySecret}
                onChange={field('payments', 'razorpayKeySecret')}
                placeholder={payments.hasRazorpayKeySecret ? '•••••••• saved — leave blank to keep' : 'Paste the key secret'}
                autoComplete="new-password"
              />
              <Input
                label="Webhook secret"
                type="password"
                value={payments.razorpayWebhookSecret}
                onChange={field('payments', 'razorpayWebhookSecret')}
                placeholder={payments.hasRazorpayWebhookSecret ? '•••••••• saved — leave blank to keep' : 'Optional but recommended'}
                autoComplete="new-password"
              />
              <div>
                <p className="field-label">Webhook URL</p>
                <code className="block break-all rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-[12px] text-primary-800">{webhookUrl}</code>
                <p className="mt-1.5 text-xs text-ink-500">Add it in Razorpay → Webhooks with the events payment.captured, payment.failed and order.paid.</p>
              </div>
            </div>
          )}

          <div className="mt-6 divide-y divide-ink-100">
            <Toggle
              id="auto-enrol"
              label="Auto-enrol on successful payment"
              description="A verified gateway payment unlocks the course straight away. When off, you enrol the learner from Payments."
              checked={payments.autoEnrolOnSuccess}
              onChange={set('payments', 'autoEnrolOnSuccess')}
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input label="UPI ID for manual payments" value={payments.upiId} onChange={field('payments', 'upiId')} placeholder="yourname@bank" />
            <Input label="Currency" value={payments.currency} disabled hint="Prices are in Indian rupees." />
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="bank-details">Bank details for transfers</label>
              <textarea id="bank-details" className="field-input min-h-[80px] resize-y" value={payments.bankDetails} onChange={field('payments', 'bankDetails')} placeholder={'Account name\nAccount number\nIFSC'} />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="pay-instructions">Payment instructions shown at checkout</label>
              <textarea id="pay-instructions" className="field-input min-h-[70px] resize-y" value={payments.instructions} onChange={field('payments', 'instructions')} placeholder="e.g. Add your registered email as the payment note." />
            </div>
          </div>
          <div className="mt-6">{saveButton(['payments'])}</div>
        </Panel>
      )}

      {/* --- email & notifications ------------------------------------------ */}
      {tab === 'email' && (
        <div className="space-y-6">
          <Panel
            icon={Mail}
            title="Email (SMTP)"
            description="Used for password resets, and for notification copies when switched on."
            actions={emailConfigured ? <Pill tone="green">Email is set up</Pill> : <Pill tone="amber">Not set up</Pill>}
          >
            {!emailConfigured && (
              <Alert tone="info" className="mb-4">
                Until SMTP is set up, password reset links are printed in the server console instead of being emailed.
              </Alert>
            )}
            <div className="divide-y divide-ink-100">
              <Toggle id="email-enabled" label="Send email" checked={email.enabled} onChange={set('email', 'enabled')} description="Use the SMTP server below." />
              <Toggle
                id="email-copies"
                label="Email a copy of notifications"
                checked={email.notificationCopies}
                onChange={set('email', 'notificationCopies')}
                description="Learners and admins also receive notifications by email."
              />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Input label="SMTP host" value={email.smtpHost} onChange={field('email', 'smtpHost')} placeholder="smtp.gmail.com" />
              <Input label="Port" type="number" value={email.smtpPort} onChange={field('email', 'smtpPort')} />
              <Input label="Username" value={email.smtpUser} onChange={field('email', 'smtpUser')} autoComplete="off" />
              <Input
                label="Password"
                type="password"
                value={email.smtpPass}
                onChange={field('email', 'smtpPass')}
                placeholder={email.hasSmtpPass ? '•••••••• saved — leave blank to keep' : ''}
                autoComplete="new-password"
              />
              <Input label="From name" value={email.fromName} onChange={field('email', 'fromName')} />
              <Input label="From email" type="email" value={email.fromEmail} onChange={field('email', 'fromEmail')} />
              <label className="flex items-center gap-2 text-[13px] text-ink-700">
                <input type="checkbox" className="h-4 w-4 rounded border-primary-200 text-primary-600" checked={email.smtpSecure} onChange={(e) => set('email', 'smtpSecure')(e.target.checked)} />
                Use SSL/TLS (port 465)
              </label>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-ink-100 pt-5">
              <Button variant="secondary" onClick={onTestEmail} loading={testing} disabled={!emailConfigured}>
                <Send className="h-4 w-4" aria-hidden="true" />
                Send test email
              </Button>
              <Button onClick={() => save(['email'])} loading={saving}>
                <Save className="h-4 w-4" aria-hidden="true" />
                Save email settings
              </Button>
            </div>
          </Panel>

          <Panel icon={Bell} title="Notification settings" description="Choose which automatic notifications are sent. Messages you compose by hand always go out.">
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="text-[13px] font-semibold text-ink-800">Admin bell</p>
                <div className="divide-y divide-ink-100">
                  {ADMIN_EVENTS.map(([key, label]) => (
                    <Toggle key={key} id={`admin-${key}`} label={label} checked={notifications.admin[key]} onChange={setNotification('admin', key)} />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-ink-800">Learner bell</p>
                <div className="divide-y divide-ink-100">
                  {LEARNER_EVENTS.map(([key, label]) => (
                    <Toggle key={key} id={`learner-${key}`} label={label} checked={notifications.learner[key]} onChange={setNotification('learner', key)} />
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-6">{saveButton(['notifications'])}</div>
          </Panel>
        </div>
      )}
    </div>
  );
}
