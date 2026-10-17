import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import AuthLayout from '../components/layout/AuthLayout.jsx';
import Button from '../components/common/Button.jsx';
import Input from '../components/common/Input.jsx';
import { forgotPassword, toErrorMessage } from '../api/client.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Step one of a password reset: ask for the email and send a single-use
 * link. The response is the same whether or not the address has an account.
 */
export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!emailPattern.test(email)) {
      setError('Enter a valid email address');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title={sent ? 'Check your email' : 'Forgot your password?'}
      subtitle={sent ? undefined : "Enter your account's email and we'll send you a link to choose a new one."}
      footer={
        <Link to="/login" className="inline-flex items-center gap-1.5 font-semibold text-primary-700 hover:text-primary-800">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-relaxed text-emerald-800">
          <CheckCircle2 className="mb-2 h-6 w-6" aria-hidden="true" />
          If an account exists for <strong className="font-semibold">{email}</strong>, a reset link is on its way. It works once and
          expires in 60 minutes. Didn&apos;t get it? Check spam, or try again in a minute.
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <Input
            label="Email address"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            icon={Mail}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError('');
            }}
            error={error}
            required
          />
          <Button type="submit" size="lg" fullWidth loading={submitting}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
