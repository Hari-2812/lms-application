import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2, Lock } from 'lucide-react';
import AuthLayout from '../components/layout/AuthLayout.jsx';
import Button from '../components/common/Button.jsx';
import Input from '../components/common/Input.jsx';
import { resetPassword, toErrorMessage } from '../api/client.js';

/** Step two of a password reset: the page the emailed link opens. */
export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const email = params.get('email') || '';

  const [form, setForm] = useState({ password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    const next = {};
    if (form.password.length < 8) next.password = 'Use at least 8 characters';
    if (form.confirm !== form.password) next.confirm = 'Passwords do not match';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      await resetPassword({ email, token, password: form.password });
      setDone(true);
    } catch (err) {
      setSubmitError(toErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!token || !email) {
    return (
      <AuthLayout title="Reset link incomplete" subtitle="Open the link from your email again, or request a new one.">
        <Button to="/forgot-password" fullWidth size="lg">
          Request a new link
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={done ? 'Password updated' : 'Choose a new password'}
      subtitle={done ? undefined : `For ${email}`}
      footer={
        !done && (
          <Link to="/forgot-password" className="font-semibold text-primary-700 hover:text-primary-800">
            Request a new link
          </Link>
        )
      }
    >
      {done ? (
        <div className="space-y-5">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
            <CheckCircle2 className="mb-2 h-6 w-6" aria-hidden="true" />
            Your password has been changed and any other signed-in sessions were signed out.
          </div>
          <Button to="/login" fullWidth size="lg">
            Sign in
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {submitError && (
            <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {submitError}
            </div>
          )}
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            icon={Lock}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            error={errors.password}
            hint="Use 8 or more characters."
            required
          />
          <Input
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            icon={Lock}
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            error={errors.confirm}
            required
          />
          <Button type="submit" size="lg" fullWidth loading={submitting}>
            Update password
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
