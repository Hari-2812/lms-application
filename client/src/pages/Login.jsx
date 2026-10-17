import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, Lock, Mail } from 'lucide-react';
import AuthLayout from '../components/layout/AuthLayout.jsx';
import Button from '../components/common/Button.jsx';
import Checkbox from '../components/common/Checkbox.jsx';
import Input from '../components/common/Input.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { toErrorMessage } from '../api/client.js';

const points = [
  'Pick up any lesson exactly where you stopped',
  'Track completion across every enrolled course',
  'Earn a certificate when a course is finished',
];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { signIn, isAuthenticated, student } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();

  const [form, setForm] = useState({ email: '', password: '', remember: true });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  /**
   * Where to land after signing in, in order of preference: the page a
   * ProtectedRoute bounced the student away from, then an explicit ?next=
   * (used by the enrol flow), then the dashboard. The parameter is
   * restricted to in-app paths so it cannot redirect off-site.
   */
  const requestedNext = params.get('next') || '';
  const destination =
    location.state?.from?.pathname ||
    (requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '') ||
    '/dashboard';

  // Passed along when switching to the sign-up form.
  const nextQuery = requestedNext ? `?next=${encodeURIComponent(requestedNext)}` : '';

  // Staff land in the admin panel unless they were heading somewhere specific.
  const landingFor = (user) => (user?.role === 'admin' && destination === '/dashboard' ? '/admin' : destination);

  // Send an already-signed-in student straight through.
  if (isAuthenticated) {
    return <Navigate to={landingFor(student)} replace />;
  }

  const setField = (name) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!form.email.trim()) next.email = 'Enter your email address';
    else if (!emailPattern.test(form.email)) next.email = 'Enter a valid email address';
    if (!form.password) next.password = 'Enter your password';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      const signedIn = await signIn(form);
      navigate(landingFor(signedIn), { replace: true });
    } catch (err) {
      setSubmitError(toErrorMessage(err, 'We could not sign you in. Check your details and try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue your learning journey."
      points={points}
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to={`/register${nextQuery}`} className="font-semibold text-primary-700 hover:text-primary-800">
            Create account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {submitError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {submitError}
          </div>
        )}

        <Input
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          icon={Mail}
          value={form.email}
          onChange={setField('email')}
          error={errors.email}
          required
        />

        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          icon={Lock}
          value={form.password}
          onChange={setField('password')}
          error={errors.password}
          required
        />

        <div className="flex items-center justify-between gap-4">
          <Checkbox label="Remember me" checked={form.remember} onChange={setField('remember')} />
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-primary-700 hover:text-primary-800"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" size="lg" fullWidth loading={submitting}>
          {submitting ? 'Signing in…' : 'Sign In'}
          {!submitting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
        </Button>
      </form>

      {/*
        The backend exposes no OAuth provider, so no Google button is shown
        here — adding one that cannot complete a sign-in would be misleading.
        Wire it up alongside /api/auth/google when that route exists.
      */}
    </AuthLayout>
  );
}
