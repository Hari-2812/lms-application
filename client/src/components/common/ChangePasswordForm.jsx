import { useState } from 'react';
import { AlertCircle, CheckCircle2, KeyRound, Lock } from 'lucide-react';
import { changePassword, toErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext.jsx';
import Button from './Button.jsx';
import Input from './Input.jsx';

/**
 * Current + new password form, shared by learner Settings and the admin
 * "My account" page. A successful change signs out every other session; the
 * fresh token the server returns keeps this one signed in.
 */
export default function ChangePasswordForm() {
  const { replaceToken } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
    setError('');
    setDone(false);
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (form.newPassword.length < 8) return setError('Use at least 8 characters.');
    if (form.newPassword !== form.confirm) return setError('The new passwords do not match.');

    setSaving(true);
    try {
      const { token } = await changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      replaceToken(token);
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      setDone(true);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[13px] text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Password changed. Any other signed-in sessions have been signed out.
        </p>
      )}
      <Input label="Current password" type="password" icon={Lock} required autoComplete="current-password" value={form.currentPassword} onChange={set('currentPassword')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="New password" type="password" icon={Lock} required autoComplete="new-password" hint="At least 8 characters." value={form.newPassword} onChange={set('newPassword')} />
        <Input label="Confirm new password" type="password" icon={Lock} required autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
      </div>
      <Button type="submit" loading={saving}>
        <KeyRound className="h-4 w-4" aria-hidden="true" />
        Change password
      </Button>
    </form>
  );
}
