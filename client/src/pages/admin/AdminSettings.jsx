import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  Home,
  ImagePlus,
  LogIn,
  Mail,
  Palette,
  Save,
  Send,
  Settings,
  Sheet,
} from 'lucide-react';
import {
  API_ORIGIN,
  getAdminSettings,
  resolveMediaUrl,
  sendTestEmail,
  testGoogleSheet,
  toErrorMessage,
  updateAdminSettings,
  uploadCourseImage,
} from '../../api/client';
import { isValidLink } from '../../utils/url.js';
import { LOGO_FULL_SRC } from '../../components/common/Logo.jsx';
import { usePageMeta } from '../../components/layout/DashboardLayout.jsx';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import { useBranding } from '../../context/BrandingContext.jsx';
import { AdminTabs, Alert, LoadingRow, PageHeader, Panel, Pill, Toggle, useFlash } from '../../components/admin/ui.jsx';

/**
 * Admin → LMS settings: branding, the sign-in page panel, the homepage image,
 * payment gateway, email and notification switches, and the Google Sheet that
 * Enroll Now enquiries are copied to. Each tab saves only its own section.
 */

const TABS = [
  { value: 'branding', label: 'Branding', icon: Palette },
  { value: 'login', label: 'Sign-in page', icon: LogIn },
  { value: 'homepage', label: 'Homepage', icon: Home },
  { value: 'payments', label: 'Payment gateway', icon: CreditCard },
  { value: 'email', label: 'Email & notifications', icon: Mail },
  { value: 'integrations', label: 'Google Sheet', icon: Sheet },
];
const TAB_VALUES = TABS.map((t) => t.value);

const ADMIN_EVENTS = [
  ['learnerRegistered', 'New learner registered'],
  ['paymentReceived', 'Payment received'],
  ['paymentPending', 'Payment pending'],
  ['paymentFailed', 'Payment failed'],
  ['taskSubmitted', 'Task submitted and awaiting review'],
  ['learnerEnrolled', 'Learner enrolled in a course'],
  ['certificateIssued', 'Certificate issued'],
  ['newEnquiry', 'New Enroll Now enquiry from the homepage'],
  ['reviewPosted', 'Learner posted a course review'],
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
  const [params, setParams] = useSearchParams();
  const initialTab = TAB_VALUES.includes(params.get('tab')) ? params.get('tab') : 'branding';
  const [tab, setTabState] = useState(initialTab);
  const [settings, setSettings] = useState(null);
  const [emailConfigured, setEmailConfigured] = useState(false);
  // { configured, provider: 'resend' | 'smtp', source: 'settings' | 'env', fromAddress, testSender }
  const [emailStatus, setEmailStatus] = useState({ configured: false });
  const [serviceAccountEmail, setServiceAccountEmail] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sheetTesting, setSheetTesting] = useState(false);
  // Which image field is uploading, and how far along: { key, percent }.
  const [uploading, setUploading] = useState(null);
  const fileRef = useRef(null);
  const uploadTarget = useRef(null);

  // The tab lives in the URL so other pages can link straight to one.
  const setTab = (value) => {
    setTabState(value);
    const next = new URLSearchParams(params);
    next.set('tab', value);
    setParams(next, { replace: true });
  };

  usePageMeta('LMS settings', 'Branding, sign-in and homepage content, payments, email and the Google Sheet.');

  useEffect(() => {
    getAdminSettings()
      .then((data) => {
        setSettings(data.settings);
        setEmailConfigured(data.emailConfigured);
        setEmailStatus(data.emailStatus || { configured: data.emailConfigured });
        setServiceAccountEmail(data.serviceAccountEmail);
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

  /** Links checked here as well as on the server, so a typo is caught before saving. */
  const LINK_CHECKS = {
    loginPage: [['imageUrl', 'Image', true]],
    homepage: [
      ['heroImageUrl', 'Homepage image', true],
      ['heroImageLink', 'Image link', false],
    ],
  };

  const save = async (sections) => {
    for (const section of sections) {
      for (const [key, label, allowUploads] of LINK_CHECKS[section] || []) {
        if (!isValidLink(settings[section][key], { allowUploads })) {
          flash.error(`${label} must be a full link starting with https://`);
          return;
        }
      }
    }
    setSaving(true);
    try {
      const patch = Object.fromEntries(sections.map((s) => [s, settings[s]]));
      const data = await updateAdminSettings(patch);
      setSettings(data.settings);
      setEmailConfigured(data.emailConfigured);
      setEmailStatus(data.emailStatus || { configured: data.emailConfigured });
      setServiceAccountEmail(data.serviceAccountEmail);
      refreshBranding();
      flash.success('Settings saved.');
    } catch (err) {
      flash.error(toErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  /** Opens the file picker for one image field, e.g. ['homepage', 'heroImageUrl']. */
  const pickImage = (section, key) => {
    uploadTarget.current = [section, key];
    fileRef.current?.click();
  };

  const onImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    const target = uploadTarget.current;
    if (!file || !target) return;
    const [section, key] = target;
    try {
      const result = await uploadCourseImage(file, (percent) => setUploading({ key, percent }));
      set(section, key)(result.url);
    } catch (err) {
      flash.error(toErrorMessage(err));
    } finally {
      setUploading(null);
    }
  };

  const uploadButton = (section, key, label, variant = 'secondary') => (
    <Button size="sm" variant={variant} loading={uploading?.key === key} onClick={() => pickImage(section, key)}>
      <ImagePlus className="h-4 w-4" aria-hidden="true" />
      {uploading?.key === key ? `Uploading ${uploading.percent || 0}%` : label}
    </Button>
  );

  const onTestSheet = async () => {
    setSheetTesting(true);
    try {
      const result = await testGoogleSheet();
      flash.success(result.message);
    } catch (err) {
      flash.error(toErrorMessage(err));
    } finally {
      setSheetTesting(false);
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

  const { branding, loginPage, homepage, integrations, certificate, payments, email, notifications } = settings;
  // No choice saved yet: Resend if a key is saved (or nothing is set up), else the SMTP server already filled in.
  const emailProvider = email.provider || (email.hasResendApiKey || !email.smtpHost ? 'resend' : 'smtp');
  const sheetUrl = integrations.googleSheetId ? `https://docs.google.com/spreadsheets/d/${integrations.googleSheetId}/edit` : '';
  const loginPoints = String(loginPage.points || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
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
      {/* One hidden picker shared by every image upload on this page. */}
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onImage} />

      {/* --- branding ------------------------------------------------------ */}
      {tab === 'branding' && (
        <Panel icon={Palette} title="Platform name and branding" description="The name is used in the browser tab title, emails and on the payment page. The Analytics Avenue logo itself is fixed.">
          <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
            <div className="grid content-start gap-4 sm:grid-cols-2">
              <Input label="Platform name" value={branding.platformName} maxLength={60} onChange={field('branding', 'platformName')} />
              <Input label="Tagline" value={branding.tagline} maxLength={60} onChange={field('branding', 'tagline')} hint="Added after the name in the browser tab title and footer, e.g. EduTech." />
              <Input label="Support email" type="email" value={branding.supportEmail} onChange={field('branding', 'supportEmail')} />
            </div>

            <div className="rounded-xl bg-primary-800 p-5 text-center">
              <p className="text-[12px] text-primary-200">Preview</p>
              <div className="mx-auto mt-4 inline-flex rounded-xl bg-white px-3 py-2">
                <img src={LOGO_FULL_SRC} alt="" className="h-24 w-auto" />
              </div>
              <p className="mt-4 text-[11px] uppercase tracking-wide text-primary-200">Browser tab title</p>
              <p className="mt-0.5 text-sm font-semibold text-white">
                {[branding.platformName || 'Platform name', branding.tagline].filter(Boolean).join(' ')}
              </p>
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

      {/* --- sign-in page ---------------------------------------------------- */}
      {tab === 'login' && (
        <Panel
          icon={LogIn}
          title="Sign-in page — left panel"
          description="The blue panel beside the sign-in, sign-up and password forms (shown on laptop and desktop screens). Use it for a welcome message, a new batch or an upcoming event."
          actions={
            <Button to="/login" size="sm" variant="secondary" target="_blank">
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Open sign-in page
            </Button>
          }
        >
          <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
            <div className="space-y-4">
              <Input label="Heading" value={loginPage.heading} maxLength={120} onChange={field('loginPage', 'heading')} />
              <div>
                <label className="field-label" htmlFor="login-description">Text under the heading</label>
                <textarea id="login-description" className="field-input min-h-[80px] resize-y" maxLength={600} value={loginPage.description} onChange={field('loginPage', 'description')} />
              </div>
              <div>
                <label className="field-label" htmlFor="login-points">Bullet points — one per line</label>
                <textarea id="login-points" className="field-input min-h-[100px] resize-y" maxLength={1000} value={loginPage.points} onChange={field('loginPage', 'points')} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Image (optional)" value={loginPage.imageUrl} onChange={field('loginPage', 'imageUrl')} placeholder="Upload or paste an https:// link" />
                <Input label="Image description" value={loginPage.imageAlt} maxLength={120} onChange={field('loginPage', 'imageAlt')} hint="Read aloud by screen readers." />
              </div>
              <div className="flex flex-wrap gap-2">
                {uploadButton('loginPage', 'imageUrl', 'Upload image')}
                {loginPage.imageUrl && (
                  <Button size="sm" variant="ghost" onClick={() => set('loginPage', 'imageUrl')('')}>Remove image</Button>
                )}
              </div>
            </div>

            {/* Live preview of the panel. */}
            <div className="rounded-2xl bg-gradient-to-br from-primary-800 via-primary-700 to-primary-600 p-5 text-white">
              <p className="text-[11px] uppercase tracking-wide text-primary-200">Preview</p>
              <p className="mt-3 text-lg font-semibold leading-snug">{loginPage.heading || 'Heading'}</p>
              {loginPage.description && <p className="mt-2 whitespace-pre-line text-[12.5px] leading-relaxed text-primary-100">{loginPage.description}</p>}
              {loginPoints.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {loginPoints.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-[12px] text-primary-50">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-200" aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
              )}
              {loginPage.imageUrl && isValidLink(loginPage.imageUrl, { allowUploads: true }) && (
                <img src={resolveMediaUrl(loginPage.imageUrl)} alt="" className="mt-4 max-h-40 w-full rounded-xl object-cover" />
              )}
            </div>
          </div>
          <div className="mt-6">{saveButton(['loginPage'])}</div>
        </Panel>
      )}

      {/* --- homepage -------------------------------------------------------- */}
      {tab === 'homepage' && (
        <Panel
          icon={Home}
          title="Homepage image"
          description="The large picture on the right of the homepage banner. Swap it for an upcoming event, an announcement or a new batch; leave it empty to show the default photo."
          actions={
            <Button to="/" size="sm" variant="secondary" target="_blank">
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Open homepage
            </Button>
          }
        >
          <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
            <div className="space-y-4">
              <Input
                label="Image"
                value={homepage.heroImageUrl}
                onChange={field('homepage', 'heroImageUrl')}
                placeholder="Upload or paste an https:// link"
                hint="A tall (portrait) image works best, e.g. 900 × 1100 pixels. PNG, JPG or WebP."
              />
              <div className="flex flex-wrap gap-2">
                {uploadButton('homepage', 'heroImageUrl', 'Upload image')}
                {homepage.heroImageUrl && (
                  <Button size="sm" variant="ghost" onClick={() => set('homepage', 'heroImageUrl')('')}>Use the default photo</Button>
                )}
              </div>
              <Input label="Image description" value={homepage.heroImageAlt} maxLength={160} onChange={field('homepage', 'heroImageAlt')} hint="Read aloud by screen readers, e.g. 'Data Science bootcamp — starts 1 December'." />
              <Input
                label="Link when the image is clicked (optional)"
                value={homepage.heroImageLink}
                onChange={field('homepage', 'heroImageLink')}
                placeholder="https://… — an event page, a registration form"
                hint="Opens in a new tab. Leave empty for a plain image."
              />
            </div>
            <div>
              <p className="field-label">Preview</p>
              <div className="aspect-[4/5] overflow-hidden rounded-xl border border-ink-200 bg-ink-50">
                <img
                  src={homepage.heroImageUrl && isValidLink(homepage.heroImageUrl, { allowUploads: true }) ? resolveMediaUrl(homepage.heroImageUrl) : '/homepage/mentors/mentooors1.jpeg'}
                  alt=""
                  className="h-full w-full object-cover object-top"
                />
              </div>
            </div>
          </div>
          <div className="mt-6">{saveButton(['homepage'])}</div>
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
            title="Email"
            description="Used for password resets, and for notification copies when switched on."
            actions={emailConfigured ? <Pill tone="green">Email is set up</Pill> : <Pill tone="amber">Not set up</Pill>}
          >
            {emailStatus.configured ? (
              <Alert tone={emailStatus.testSender ? 'warning' : 'success'} className="mb-4">
                Sending with <strong>{emailStatus.provider === 'resend' ? 'Resend' : 'SMTP'}</strong>
                {emailStatus.source === 'env' ? ' (key from server/.env)' : ''}
                {emailStatus.fromAddress ? <> from <strong>{emailStatus.fromAddress}</strong></> : ''}.
                {emailStatus.testSender &&
                  ' This is Resend’s test sender: it only delivers to your own Resend account. Verify your domain in Resend and set "From email" below to an address on it.'}
              </Alert>
            ) : (
              <Alert tone="info" className="mb-4">
                Until email is set up, password reset links are printed in the server console instead of being emailed.
              </Alert>
            )}
            <div className="divide-y divide-ink-100">
              <Toggle id="email-enabled" label="Send email" checked={email.enabled} onChange={set('email', 'enabled')} description="Use the provider chosen below." />
              <Toggle
                id="email-copies"
                label="Email a copy of notifications"
                checked={email.notificationCopies}
                onChange={set('email', 'notificationCopies')}
                description="Learners and admins also receive notifications by email."
              />
            </div>

            <div className="mt-4">
              <p className="field-label">Send with</p>
              <AdminTabs
                tabs={[
                  { value: 'resend', label: 'Resend (recommended)' },
                  { value: 'smtp', label: 'SMTP server' },
                ]}
                value={emailProvider}
                onChange={set('email', 'provider')}
              />
            </div>

            {emailProvider === 'resend' ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Input
                    label="Resend API key"
                    type="password"
                    value={email.resendApiKey}
                    onChange={field('email', 'resendApiKey')}
                    placeholder={
                      email.hasResendApiKey
                        ? '•••••••• saved — leave blank to keep'
                        : emailStatus.provider === 'resend' && emailStatus.source === 'env'
                          ? 'Using RESEND_API_KEY from server/.env'
                          : 're_…'
                    }
                    autoComplete="new-password"
                    hint="resend.com → API Keys → Create (Sending access). You can put it in server/.env as RESEND_API_KEY instead."
                  />
                </div>
                <Input label="From name" value={email.fromName} onChange={field('email', 'fromName')} />
                <Input
                  label="From email"
                  type="email"
                  value={email.fromEmail}
                  onChange={field('email', 'fromEmail')}
                  placeholder="no-reply@yourdomain.com"
                  hint="Must be on a domain verified in Resend (Domains)."
                />
              </div>
            ) : (
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
            )}
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

      {/* --- Google Sheet ----------------------------------------------------- */}
      {tab === 'integrations' && (
        <Panel
          icon={Sheet}
          title="Google Sheet for Enroll Now enquiries"
          description="Every response to the homepage Enroll Now form is saved in Admin → Enquiries and added as a new row in this sheet."
          actions={
            sheetUrl && (
              <Button href={sheetUrl} size="sm" variant="secondary" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Open sheet
              </Button>
            )
          }
        >
          <ol className="mb-6 space-y-2 rounded-xl border border-primary-100 bg-primary-50/50 p-4 text-[13px] leading-relaxed text-ink-700">
            <li>
              <strong className="font-semibold">1. Share the sheet</strong> with this address as <strong className="font-semibold">Editor</strong>:{' '}
              {serviceAccountEmail ? (
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  <code className="break-all rounded bg-white px-1.5 py-0.5 text-[12px] text-primary-800">{serviceAccountEmail}</code>
                  <button type="button" onClick={() => navigator.clipboard?.writeText(serviceAccountEmail)} className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary-700 hover:text-primary-800">
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copy
                  </button>
                </span>
              ) : (
                <span className="text-red-600">no Google service account is set up on the server yet.</span>
              )}
            </li>
            <li>
              <strong className="font-semibold">2. Turn on the Google Sheets API</strong> for that service account&apos;s Google Cloud project (APIs &amp; Services → Library → Google Sheets API → Enable). This only needs doing once.
            </li>
            <li>
              <strong className="font-semibold">3. Paste the sheet link below, save, then press Test connection.</strong> The column headings are added automatically if the sheet is empty.
            </li>
          </ol>

          <div className="divide-y divide-ink-100">
            <Toggle
              id="sheet-enabled"
              label="Copy enquiries to the Google Sheet"
              description="When off, enquiries are still saved in Admin → Enquiries."
              checked={integrations.googleSheetEnabled}
              onChange={set('integrations', 'googleSheetEnabled')}
            />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_14rem]">
            <Input
              label="Google Sheet link"
              value={integrations.googleSheetId}
              onChange={field('integrations', 'googleSheetId')}
              placeholder="https://docs.google.com/spreadsheets/d/…"
              hint="The full link or just the long id from it."
            />
            <Input
              label="Tab name (optional)"
              value={integrations.googleSheetTab}
              maxLength={80}
              onChange={field('integrations', 'googleSheetTab')}
              placeholder="First tab"
              hint="Created automatically if it does not exist."
            />
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-ink-100 pt-5">
            <Button variant="secondary" onClick={onTestSheet} loading={sheetTesting} disabled={!integrations.googleSheetId}>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Test connection
            </Button>
            <Button onClick={() => save(['integrations'])} loading={saving}>
              <Save className="h-4 w-4" aria-hidden="true" />
              Save
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
}
