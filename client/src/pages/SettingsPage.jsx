import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, LogOut, Monitor, Shield, Trash2, User } from 'lucide-react';
import { usePageMeta } from '../components/layout/DashboardLayout.jsx';
import Button from '../components/common/Button.jsx';
import Modal from '../components/common/Modal.jsx';
import ChangePasswordForm from '../components/common/ChangePasswordForm.jsx';
import { useAuth } from '../context/AuthContext.jsx';

/** A labelled on/off switch used by the notification preferences. */
function Toggle({ id, label, description, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-6 py-4">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-ink-900">
          {label}
        </label>
        <p className="mt-0.5 text-[13px] leading-relaxed text-ink-500">{description}</p>
      </div>

      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? 'bg-primary-600' : 'bg-ink-200'
        }`}
      >
        <span
          className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

const PREFS_KEY = 'lms.preferences';

function readPrefs() {
  try {
    return {
      courseUpdates: true,
      weeklyDigest: true,
      productNews: false,
      autoplayNext: true,
      ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'),
    };
  } catch {
    return { courseUpdates: true, weeklyDigest: true, productNews: false, autoplayNext: true };
  }
}

export default function SettingsPage() {
  const { student, signOut } = useAuth();
  const navigate = useNavigate();

  const [prefs, setPrefs] = useState(readPrefs);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  usePageMeta('Settings', 'Preferences for your account and learning experience.');

  const setPref = (key) => (value) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      /* preferences simply won't persist in private mode */
    }
  };

  const accountRows = [
    { label: 'Full name', value: student?.name },
    { label: 'Email', value: student?.email },
    { label: 'Phone', value: student?.phone },
    { label: 'Member since', value: student?.createdAt ? new Date(student.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '' },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <section className="card p-6">
        <div className="flex items-center gap-2.5">
          <User className="h-4 w-4 text-ink-400" aria-hidden="true" />
          <h2 className="text-base font-semibold text-ink-900">Account</h2>
        </div>

        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          {accountRows.map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</dt>
              <dd className="mt-1 truncate text-sm text-ink-900">{value || '—'}</dd>
            </div>
          ))}
        </dl>

        <Button variant="secondary" size="sm" className="mt-6" onClick={() => navigate('/profile')}>
          Edit profile
        </Button>
      </section>

      <section className="card p-6">
        <div className="flex items-center gap-2.5">
          <Bell className="h-4 w-4 text-ink-400" aria-hidden="true" />
          <h2 className="text-base font-semibold text-ink-900">Notifications</h2>
        </div>

        <div className="mt-2 divide-y divide-ink-100">
          <Toggle
            id="pref-course-updates"
            label="Course updates"
            description="Get notified when a course you are enrolled in adds new lessons."
            checked={prefs.courseUpdates}
            onChange={setPref('courseUpdates')}
          />
          <Toggle
            id="pref-weekly-digest"
            label="Weekly progress digest"
            description="A short summary of what you completed each week."
            checked={prefs.weeklyDigest}
            onChange={setPref('weeklyDigest')}
          />
          <Toggle
            id="pref-product-news"
            label="Product news"
            description="Occasional updates about new platform features."
            checked={prefs.productNews}
            onChange={setPref('productNews')}
          />
        </div>
      </section>

      <section className="card p-6">
        <div className="flex items-center gap-2.5">
          <Monitor className="h-4 w-4 text-ink-400" aria-hidden="true" />
          <h2 className="text-base font-semibold text-ink-900">Playback</h2>
        </div>

        <div className="mt-2">
          <Toggle
            id="pref-autoplay"
            label="Autoplay next lesson"
            description="Move straight to the next lesson when the current one finishes."
            checked={prefs.autoplayNext}
            onChange={setPref('autoplayNext')}
          />
        </div>
      </section>

      <section className="card p-6">
        <div className="flex items-center gap-2.5">
          <Shield className="h-4 w-4 text-ink-400" aria-hidden="true" />
          <h2 className="text-base font-semibold text-ink-900">Security &amp; privacy</h2>
        </div>

        <p className="mt-3 text-[13px] leading-relaxed text-ink-600">
          Course videos stream from private storage through our own API — no shareable video link is
          ever exposed to your browser, and your playback position is stored against your account
          only.
        </p>

        <div className="mt-6 border-t border-ink-100 pt-5">
          <h3 className="mb-4 text-sm font-semibold text-ink-900">Change password</h3>
          <ChangePasswordForm />
        </div>

        <div className="mt-6 flex flex-wrap gap-3 border-t border-ink-100 pt-5">
          <Button variant="secondary" onClick={() => setConfirmSignOut(true)}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Log out
          </Button>
          <Button
            variant="ghost"
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
            title="Account deletion is not available in this build"
            disabled
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete account
          </Button>
        </div>
      </section>

      <p className="rounded-lg bg-surface-muted p-3.5 text-[13px] leading-relaxed text-ink-600">
        Preferences are stored in this browser. They will move to your account once the API exposes
        a settings endpoint.
      </p>

      <Modal
        open={confirmSignOut}
        onClose={() => setConfirmSignOut(false)}
        title="Log out?"
        description="Your progress is saved — you can pick up right where you left off next time."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmSignOut(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={signOut}>
              Log out
            </Button>
          </>
        }
      />
    </div>
  );
}
