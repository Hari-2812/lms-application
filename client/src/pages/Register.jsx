import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, Lock, Mail, Phone, User } from 'lucide-react';
import AuthLayout from '../components/layout/AuthLayout.jsx';
import Button from '../components/common/Button.jsx';
import Checkbox from '../components/common/Checkbox.jsx';
import Input from '../components/common/Input.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { toErrorMessage } from '../api/client.js';

const points = [
  'Free to join — every course in the catalogue included',
  'Your progress syncs across every device you use',
  'Start, pause and resume lessons whenever it suits you',
];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const initialForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  terms: false,
};

export default function Register() {
  const { signUp, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  /**
   * Where to land after signing up. Set by links that need the student back
   * where they started — a course page's "Enrol Now" sends
   * ?next=/courses/<id>/enrol so the account gets created and checkout
   * continues. Restricted to in-app paths so the parameter cannot be used
   * to bounce someone off-site.
   */
  const requestedNext = params.get('next') || '';
  const destination =
    requestedNext.startsWith('/') && !requestedNext.startsWith('//')
      ? requestedNext
      : '/dashboard';

  // Passed along when switching to the sign-in form.
  const nextQuery = requestedNext ? `?next=${encodeURIComponent(requestedNext)}` : '';

  if (isAuthenticated) return <Navigate to={destination} replace />;

  const setField = (name) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!form.firstName.trim()) next.firstName = 'Enter your first name';
    if (!form.lastName.trim()) next.lastName = 'Enter your last name';
    if (!form.email.trim()) next.email = 'Enter your email address';
    else if (!emailPattern.test(form.email)) next.email = 'Enter a valid email address';
    if (form.phone && !/^[+\d][\d\s-]{6,19}$/.test(form.phone.trim())) next.phone = 'Enter a valid phone number';
    if (!form.password) next.password = 'Choose a password';
    else if (form.password.length < 8) next.password = 'Use at least 8 characters';
    if (form.confirmPassword !== form.password) next.confirmPassword = 'Passwords do not match';
    if (!form.terms) next.terms = 'Please accept the terms to continue';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      await signUp(form);
      navigate(destination, { replace: true });
    } catch (err) {
      setSubmitError(toErrorMessage(err, 'We could not create your account. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join and start learning in under a minute."
      points={points}
      footer={
        <>
          Already have an account?{' '}
          <Link to={`/login${nextQuery}`} className="font-semibold text-primary-700 hover:text-primary-800">
            Sign in
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

        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="First name"
            name="firstName"
            autoComplete="given-name"
            placeholder="Jane"
            icon={User}
            value={form.firstName}
            onChange={setField('firstName')}
            error={errors.firstName}
            required
          />
          <Input
            label="Last name"
            name="lastName"
            autoComplete="family-name"
            placeholder="Doe"
            value={form.lastName}
            onChange={setField('lastName')}
            error={errors.lastName}
            required
          />
        </div>

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
          label="Phone number (optional)"
          type="tel"
          name="phone"
          autoComplete="tel"
          placeholder="+91 98765 43210"
          icon={Phone}
          value={form.phone}
          onChange={setField('phone')}
          error={errors.phone}
          hint="So our team can reach you about your enrolment."
        />

        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          icon={Lock}
          value={form.password}
          onChange={setField('password')}
          error={errors.password}
          hint="Use 8 or more characters."
          required
        />

        <Input
          label="Confirm password"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          icon={Lock}
          value={form.confirmPassword}
          onChange={setField('confirmPassword')}
          error={errors.confirmPassword}
          required
        />

        <Checkbox
          checked={form.terms}
          onChange={setField('terms')}
          error={errors.terms}
          label={
            <>
              I agree to the{' '}
              <Link to="/#legal" className="font-medium text-primary-700 hover:text-primary-800">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/#legal" className="font-medium text-primary-700 hover:text-primary-800">
                Privacy Policy
              </Link>
              .
            </>
          }
        />

        <Button type="submit" size="lg" fullWidth loading={submitting}>
          {submitting ? 'Creating account…' : 'Create Account'}
          {!submitting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
        </Button>
      </form>

      {/* No social sign-up button: the backend has no OAuth provider yet. */}
    </AuthLayout>
  );
}
