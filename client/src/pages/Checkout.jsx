import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Banknote,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Hourglass,
  Info,
  Landmark,
  Lock,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
import {
  createRazorpayOrder,
  enrol,
  getCourse,
  reportRazorpayFailure,
  toErrorMessage,
  verifyRazorpayPayment,
} from '../api/client';
import { useBranding } from '../context/BrandingContext.jsx';
import { usePageMeta } from '../components/layout/DashboardLayout.jsx';
import Badge from '../components/common/Badge.jsx';
import Button from '../components/common/Button.jsx';
import CourseThumbnail from '../components/courses/CourseThumbnail.jsx';
import { ErrorState, LoadingState } from '../components/States.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatHours, formatPrice } from '../utils/course.js';

/**
 * Checkout for one course package.
 *
 * Shows what is being bought, at what price, and what it includes, then
 * takes payment one of two ways, per Admin → LMS settings:
 *   Razorpay — the gateway's checkout; a verified payment enrols at once.
 *   Manual   — the learner pays by UPI / transfer using the details shown,
 *              and an admin marks the payment received, which enrols them.
 * A free course is granted immediately either way.
 */

const RAZORPAY_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

/** Loads Razorpay's checkout script once; resolves when window.Razorpay exists. */
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${RAZORPAY_SRC}"]`);
    const script = existing || document.createElement('script');
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error('The payment window could not be loaded. Check your connection and try again.')));
    if (!existing) {
      script.src = RAZORPAY_SRC;
      script.async = true;
      document.body.appendChild(script);
    }
  });
}

const ONLINE_METHOD = { value: 'razorpay', label: 'Pay online', hint: 'Card, UPI, net banking, wallets', icon: Wallet };

const METHODS = [
  { value: 'upi', label: 'UPI', hint: 'GPay, PhonePe, Paytm', icon: Smartphone },
  { value: 'card', label: 'Card', hint: 'Credit or debit', icon: CreditCard },
  { value: 'netbanking', label: 'Net banking', hint: 'All major banks', icon: Landmark },
  { value: 'bank-transfer', label: 'Bank transfer', hint: 'NEFT / IMPS', icon: Banknote },
];

export default function Checkout() {
  const { courseId } = useParams();
  const { student } = useAuth();
  const { payments, branding } = useBranding();
  const navigate = useNavigate();
  const online = payments.gateway === 'razorpay';

  const [course, setCourse] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [method, setMethod] = useState(online ? 'razorpay' : 'upi');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    getCourse(courseId)
      .then((data) => {
        if (cancelled) return;
        setCourse(data);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(toErrorMessage(err));
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  usePageMeta(course ? `Enrol in ${course.title}` : 'Enrol', 'Review your package and confirm.');

  // Settings load after first paint; switch the default once we know Razorpay is on.
  useEffect(() => {
    if (online) setMethod('razorpay');
  }, [online]);

  const features = useMemo(() => {
    if (!course) return [];
    if (course.features?.length > 0) return course.features;
    return [
      `${course.lessonCount} on-demand video ${course.lessonCount === 1 ? 'lesson' : 'lessons'}`,
      'Lifetime access on any device',
      'Downloadable study material',
      ...(course.certificateIncluded !== false ? ['Certificate of completion'] : []),
    ];
  }, [course]);

  if (status === 'loading') return <LoadingState label="Loading package…" />;
  if (status === 'error') return <ErrorState message={error} />;

  const price = Number(course.price) || 0;
  const isFree = price <= 0;
  const originalPrice = Number(course.originalPrice) || 0;
  const discount =
    originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;

  const alreadyEnrolled = course.hasAccess === true;
  // A pending Razorpay order is just an abandoned checkout — let them pay again.
  const awaitingPayment =
    !alreadyEnrolled && course.enrollmentStatus === 'pending' && course.enrollmentGateway !== 'razorpay';
  const lastPaymentFailed = !alreadyEnrolled && course.enrollmentStatus === 'failed';

  const hasManualDetails = Boolean(payments.upiId || payments.bankDetails || payments.instructions);
  // With Razorpay on, manual transfer is offered only when the admin gave details for it.
  const methods = online ? [ONLINE_METHOD, ...(hasManualDetails ? METHODS.filter((m) => m.value !== 'card') : [])] : METHODS;

  const payOnline = async () => {
    await loadRazorpay();
    const order = await createRazorpayOrder(course._id);

    await new Promise((resolve) => {
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: order.name,
        description: order.description,
        order_id: order.orderId,
        prefill: order.prefill,
        notes: { transactionId: order.transactionId },
        theme: { color: '#2450eb' },
        handler: async (response) => {
          try {
            const verified = await verifyRazorpayPayment({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });
            setResult({ granted: verified.granted, paid: true, transactionId: verified.transactionId });
            if (verified.granted) setTimeout(() => navigate(`/my-courses/${course._id}`), 1800);
          } catch (err) {
            setError(toErrorMessage(err));
          }
          resolve();
        },
        modal: { ondismiss: () => resolve() },
      });

      checkout.on('payment.failed', (response) => {
        const reason = response?.error?.description || 'The payment was declined';
        reportRazorpayFailure({ orderId: order.orderId, paymentId: response?.error?.metadata?.payment_id, reason }).catch(() => {});
        setError(`Payment failed: ${reason}. You can try again.`);
      });

      checkout.open();
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    if (!isFree && method === 'razorpay') {
      try {
        await payOnline();
      } catch (err) {
        setError(toErrorMessage(err));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    try {
      const response = await enrol(course._id, isFree ? 'free' : method);
      setResult(response);

      // A free course is unlocked straight away, so go to it rather than
      // leaving the student on a confirmation screen with nothing to do.
      if (response.granted) {
        setTimeout(() => navigate(`/my-courses/${course._id}`), 1200);
      }
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------- after submitting ---------------------------------------- */
  if (result) {
    const granted = result.granted || result.alreadyEnrolled;

    return (
      <div className="mx-auto max-w-xl">
        <section className="card p-8 text-center">
          <span
            className={`mx-auto grid h-14 w-14 place-items-center rounded-full ${
              granted ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
            }`}
          >
            {granted ? (
              <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
            ) : (
              <Hourglass className="h-7 w-7" aria-hidden="true" />
            )}
          </span>

          <h2 className="mt-5 text-xl font-bold text-ink-900">
            {granted ? (result.paid ? "Payment successful — you're enrolled" : "You're enrolled") : result.paid ? 'Payment received' : 'Enrolment received'}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-600">
            {granted
              ? `"${course.title}" is unlocked and ready. Taking you there now…`
              : result.paid
                ? `Your payment for "${course.title}" is confirmed. The course unlocks shortly — you'll get a notification.`
                : `We've recorded your enrolment in "${course.title}". Your access opens as soon as the payment is confirmed — you'll get a notification the moment it is.`}
          </p>
          {result.transactionId && (
            <p className="mt-3 font-mono text-[12px] text-ink-500">Transaction {result.transactionId}</p>
          )}
          {!granted && !result.paid && !isFree && hasManualDetails && (
            <ManualPaymentDetails payments={payments} amount={formatPrice(price)} className="mx-auto mt-5 max-w-sm text-left" />
          )}

          <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
            <Button to={granted ? `/my-courses/${course._id}` : '/my-courses'}>
              {granted ? 'Start learning' : 'Go to My Courses'}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button to="/courses" variant="secondary">
              Browse more courses
            </Button>
          </div>
        </section>
      </div>
    );
  }

  /* ---------- already sorted ------------------------------------------- */
  if (alreadyEnrolled || awaitingPayment) {
    return (
      <div className="mx-auto max-w-xl">
        <section className="card p-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary-50 text-primary-600">
            {alreadyEnrolled ? (
              <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
            ) : (
              <Hourglass className="h-7 w-7" aria-hidden="true" />
            )}
          </span>
          <h2 className="mt-5 text-xl font-bold text-ink-900">
            {alreadyEnrolled ? 'You already have this course' : 'Payment is being confirmed'}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-600">
            {alreadyEnrolled
              ? `"${course.title}" is already in My Courses.`
              : `We have your enrolment for "${course.title}". Nothing more to do — we'll notify you when it unlocks.`}
          </p>
          <div className="mt-7">
            <Button to={alreadyEnrolled ? `/my-courses/${course._id}` : '/my-courses'}>
              Go to My Courses
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </section>
      </div>
    );
  }

  /* ---------- the checkout itself -------------------------------------- */
  return (
    <div className="space-y-6">
      <Link
        to={`/courses/${course._id}`}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-600 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to course details
      </Link>

      {error && <ErrorState message={error} />}

      {lastPaymentFailed && !error && (
        <div role="status" className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Your last payment for this course did not go through. You can try again below.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
        {/* --- package summary ---------------------------------------- */}
        <div className="min-w-0 space-y-6">
          <section className="card overflow-hidden">
            <div className="flex flex-col gap-5 p-5 sm:flex-row">
              <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden rounded-lg bg-ink-100 sm:w-48">
                <CourseThumbnail course={course} />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {course.category && <Badge tone="primary">{course.category}</Badge>}
                  <Badge tone="neutral">{course.level}</Badge>
                </div>
                <h2 className="mt-2.5 text-lg font-bold leading-snug text-ink-900">
                  {course.title}
                </h2>
                <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-ink-600">
                  {course.summary || course.description}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-500">
                  <span className="inline-flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                    {course.lessonCount} lessons
                  </span>
                  {formatHours(course.hours) && (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      {formatHours(course.hours)}
                    </span>
                  )}
                  {course.certificateIncluded !== false && (
                    <span className="inline-flex items-center gap-1.5">
                      <Award className="h-3.5 w-3.5" aria-hidden="true" />
                      Certificate
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="card p-6">
            <h2 className="text-base font-semibold text-ink-900">What you get</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {features.map((feature) => (
                <li key={feature} className="flex gap-2.5 text-sm leading-relaxed text-ink-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  {feature}
                </li>
              ))}
            </ul>
          </section>

          {/* --- payment method ---------------------------------------- */}
          {!isFree && (
            <section className="card p-6">
              <h2 className="text-base font-semibold text-ink-900">Payment method</h2>
              <p className="mt-1 text-[13px] text-ink-500">
                {online
                  ? 'Pay securely online and the course unlocks the moment the payment succeeds.'
                  : "Pick how you'd like to pay. Use the details below, and the course unlocks once the payment is confirmed."}
              </p>

              <fieldset className="mt-4 grid gap-3 sm:grid-cols-2">
                <legend className="sr-only">Payment method</legend>
                {methods.map(({ value, label, hint, icon: Icon }) => (
                  <label
                    key={value}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3.5 transition ${
                      method === value
                        ? 'border-primary-500 bg-primary-50/60 ring-1 ring-primary-500/20'
                        : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment-method"
                      value={value}
                      checked={method === value}
                      onChange={() => setMethod(value)}
                      className="h-4 w-4 border-ink-300 text-primary-600 focus:ring-primary-500/30"
                    />
                    <Icon className="h-5 w-5 shrink-0 text-ink-500" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink-900">{label}</span>
                      <span className="block truncate text-xs text-ink-500">{hint}</span>
                    </span>
                  </label>
                ))}
              </fieldset>

              {method !== 'razorpay' && hasManualDetails && (
                <ManualPaymentDetails payments={payments} amount={formatPrice(price)} className="mt-5" />
              )}
            </section>
          )}
        </div>

        {/* --- order summary ------------------------------------------ */}
        <aside className="lg:sticky lg:top-20">
          <form onSubmit={handleSubmit} className="card p-5">
            <h2 className="text-sm font-semibold text-ink-900">Order summary</h2>

            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-600">Course price</dt>
                <dd className="font-semibold tabular-nums text-ink-900">
                  {formatPrice(originalPrice > price ? originalPrice : price)}
                </dd>
              </div>

              {discount > 0 && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-emerald-700">Discount ({discount}%)</dt>
                  <dd className="font-semibold tabular-nums text-emerald-700">
                    −{formatPrice(originalPrice - price)}
                  </dd>
                </div>
              )}

              <div className="flex items-baseline justify-between gap-3 border-t border-ink-100 pt-3">
                <dt className="font-semibold text-ink-900">Total</dt>
                <dd className="text-xl font-bold tabular-nums text-ink-900">
                  {formatPrice(price)}
                </dd>
              </div>
            </dl>

            <p className="mt-3 text-xs leading-relaxed text-ink-500">
              Enrolling as <strong className="font-semibold text-ink-700">{student?.name}</strong>{' '}
              ({student?.email}).
            </p>

            <Button type="submit" size="lg" fullWidth loading={submitting} disabled={submitting} className="mt-5">
              {isFree ? 'Enrol for Free' : method === 'razorpay' ? `Pay ${formatPrice(price)} securely` : `Confirm & pay ${formatPrice(price)}`}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>

            <p className="mt-3.5 flex items-start gap-2 text-xs leading-relaxed text-ink-500">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {isFree
                ? 'Free course — access is granted immediately.'
                : method === 'razorpay'
                  ? `Payments are processed by Razorpay for ${branding.platformName}. You'll be enrolled automatically.`
                  : 'Your enrolment is recorded now and the course unlocks as soon as the payment is confirmed.'}
            </p>

            {/* Razorpay test keys only simulate payments — say so, rather than
                let a learner's UPI app reject the QR code with no explanation. */}
            {!isFree && method === 'razorpay' && payments.razorpayKeyId?.startsWith('rzp_test_') && (
              <p role="note" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800">
                Online payment is in test mode, so no real money can be taken yet — a UPI app will not accept this
                checkout&apos;s QR code. Please try again later or contact support.
              </p>
            )}

            <div className="mt-4 flex items-start gap-2 border-t border-ink-100 pt-4 text-xs leading-relaxed text-ink-500">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
              Lessons stream from private storage through our own API — no shareable video link
              ever reaches the browser.
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}

/** UPI ID / bank details / instructions from Admin → LMS settings → Payment gateway. */
function ManualPaymentDetails({ payments, amount, className = '' }) {
  return (
    <div className={`rounded-xl border border-primary-100 bg-primary-50/50 p-4 ${className}`}>
      <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
        <Info className="h-4 w-4 text-primary-600" aria-hidden="true" />
        How to pay {amount}
      </p>
      <dl className="mt-3 space-y-2 text-[13px]">
        {payments.upiId && (
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">UPI ID</dt>
            <dd className="font-mono text-ink-900">{payments.upiId}</dd>
          </div>
        )}
        {payments.bankDetails && (
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Bank transfer</dt>
            <dd className="whitespace-pre-line text-ink-900">{payments.bankDetails}</dd>
          </div>
        )}
        {payments.instructions && <p className="whitespace-pre-line text-ink-700">{payments.instructions}</p>}
      </dl>
    </div>
  );
}
