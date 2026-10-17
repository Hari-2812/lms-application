import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Download,
  Hourglass,
  IndianRupee,
  Pencil,
  RotateCcw,
  Search,
  XCircle,
} from 'lucide-react';
import {
  cancelPayment,
  confirmPayment,
  downloadPaymentsReport,
  failPayment,
  getCourses,
  getPayments,
  retryPayment,
  toErrorMessage,
  updatePayment,
} from '../../api/client';
import { usePageMeta } from '../../components/layout/DashboardLayout.jsx';
import Button from '../../components/common/Button.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  EmptyRow,
  FilterBar,
  FilterField,
  LoadingRow,
  PageHeader,
  Panel,
  PaymentStatus,
  ReadOnlyNotice,
  StatTile,
  formatDate,
  formatMethod,
  formatMoney,
  useFlash,
} from '../../components/admin/ui.jsx';

/**
 * Admin → Payments: every transaction with its status, amount, date and
 * reference; filters by date, course and status; per-learner history; PDF
 * report; and the fixes for a payment that has not reflected (mark paid and
 * enrol, retry the enrolment, re-check Razorpay).
 */

const FILTER_KEYS = ['search', 'status', 'courseId', 'studentId', 'from', 'to', 'includeFree'];

export default function AdminPayments() {
  const { isSuperAdmin } = useAuth();
  const flash = useFlash();
  const showError = flash.error; // stable (useCallback inside useFlash)
  const [params, setParams] = useSearchParams();

  const [data, setData] = useState({ payments: [], summary: null });
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [query, setQuery] = useState(params.get('search') || '');

  usePageMeta('Payments', 'Transactions, payment status and reports.');

  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || '']));
  const activeFilters = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const load = useCallback(() => {
    setLoading(true);
    return getPayments(Object.fromEntries([...params.entries()].filter(([k, v]) => FILTER_KEYS.includes(k) && v)))
      .then(setData)
      .catch((err) => showError(toErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [params, showError]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getCourses().then(setCourses).catch(() => {});
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      if (query.trim() !== filters.search) setFilter('search', query.trim());
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed text drives this
  }, [query]);

  const act = async (payment, action, success) => {
    setBusyId(payment._id);
    try {
      const result = await action();
      flash.success(result?.message || success);
      await load();
    } catch (err) {
      flash.error(toErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const onConfirm = (payment) => {
    const reference = window.prompt(
      `Mark ${payment.transactionId} (${formatMoney(payment.amount)}) as paid and enrol ${payment.studentId?.name}?\n\nPayment reference (UPI / bank ref, optional):`,
      payment.reference || ''
    );
    if (reference === null) return;
    act(payment, () => confirmPayment(payment._id, reference), 'Payment marked successful — the learner is enrolled and notified.');
  };

  const onFail = (payment) => {
    const reason = window.prompt('Mark this payment as failed? The learner is told they can try again.\n\nReason (optional):', '');
    if (reason === null) return;
    act(payment, () => failPayment(payment._id, reason), 'Payment marked failed.');
  };

  const onCancel = (payment) => {
    if (!window.confirm(`Cancel ${payment.transactionId}? The learner will be notified.`)) return;
    act(payment, () => cancelPayment(payment._id), 'Enrolment cancelled.');
  };

  const onEditReference = (payment) => {
    const reference = window.prompt('Payment reference', payment.reference || '');
    if (reference === null) return;
    act(payment, () => updatePayment(payment._id, { reference }), 'Reference updated.');
  };

  const onDownload = async () => {
    setDownloading(true);
    try {
      await downloadPaymentsReport(activeFilters);
    } catch (err) {
      flash.error(toErrorMessage(err, 'The report could not be generated.'));
    } finally {
      setDownloading(false);
    }
  };

  const { payments, summary } = data;
  const learnerName = filters.studentId ? payments[0]?.studentId?.name : '';

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CreditCard}
        title="Payment management"
        description="Every transaction with its status, amount, date and reference. Marking a payment successful enrols the learner automatically."
        actions={
          <Button onClick={onDownload} loading={downloading} size="sm">
            <Download className="h-4 w-4" aria-hidden="true" />
            Download PDF report
          </Button>
        }
      />

      {!isSuperAdmin && <ReadOnlyNotice />}
      {flash.node}

      {summary && (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile featured icon={IndianRupee} label="Successful" value={formatMoney(summary.successfulAmount)} hint={`${summary.byStatus.completed} payments`} />
          <StatTile icon={Hourglass} tone="amber" label="Pending" value={summary.byStatus.pending} hint={`${formatMoney(summary.pendingAmount)} awaiting confirmation`} />
          <StatTile icon={XCircle} tone="red" label="Failed" value={summary.byStatus.failed} />
          <StatTile icon={CreditCard} label="Transactions shown" value={summary.count} hint={summary.byStatus.cancelled ? `${summary.byStatus.cancelled} cancelled` : undefined} />
        </section>
      )}

      <Panel
        icon={CreditCard}
        title={learnerName ? `Payment history — ${learnerName}` : 'Transactions'}
        description={
          filters.studentId ? (
            <span>
              Showing one learner.{' '}
              <button type="button" className="font-semibold text-primary-700 underline" onClick={() => setFilter('studentId', '')}>
                Show everyone
              </button>
            </span>
          ) : (
            'Search by learner, transaction ID or reference.'
          )
        }
        bodyClassName=""
      >
        <FilterBar>
          <FilterField label="Search" className="lg:min-w-[18rem] lg:flex-1">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-400" aria-hidden="true" />
              <input
                type="search"
                className="admin-field w-full pl-9"
                placeholder="Learner, TXN ID or reference"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </FilterField>
          <FilterField label="Status" className="lg:w-40">
            <select className="admin-field" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
              <option value="">All</option>
              <option value="completed">Successful</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </FilterField>
          <FilterField label="Course" className="lg:w-56">
            <select className="admin-field" value={filters.courseId} onChange={(e) => setFilter('courseId', e.target.value)}>
              <option value="">All courses</option>
              {courses.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.title}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="From" className="lg:w-40">
            <input type="date" className="admin-field" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
          </FilterField>
          <FilterField label="To" className="lg:w-40">
            <input type="date" className="admin-field" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} />
          </FilterField>
          <label className="flex h-10 items-center gap-2 self-start text-[13px] text-ink-700 lg:self-end">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-primary-200 text-primary-600 focus:ring-primary-500/30"
              checked={filters.includeFree === 'true'}
              onChange={(e) => setFilter('includeFree', e.target.checked ? 'true' : '')}
            />
            Include free enrolments
          </label>
        </FilterBar>

        {loading && !payments.length ? (
          <LoadingRow label="Loading payments…" />
        ) : payments.length === 0 ? (
          <EmptyRow icon={CreditCard} title="No transactions match" description="Paid checkouts appear here as soon as a learner enrols." />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table min-w-[56rem]">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Transaction</th>
                  <th>Learner</th>
                  <th>Course</th>
                  <th className="text-right">Amount</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const busy = busyId === payment._id;
                  const notReflected = payment.status === 'completed' && !payment.accessActive;
                  const isOpen = expanded === payment._id;
                  return (
                    <Fragment key={payment._id}>
                      <tr>
                        <td className="whitespace-nowrap">
                          <p className="text-[13px]">{formatDate(payment.createdAt)}</p>
                          <p className="text-[11.5px] text-ink-400">
                            {new Date(payment.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => setExpanded(isOpen ? null : payment._id)}
                            className="inline-flex items-center gap-1 whitespace-nowrap font-mono text-[12px] font-semibold text-primary-700 hover:text-primary-800"
                            aria-expanded={isOpen}
                          >
                            {payment.transactionId}
                            {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>
                          <p className="max-w-[13rem] truncate text-[11.5px] text-ink-500" title={payment.reference || undefined}>
                            {formatMethod(payment.method)} · {payment.reference ? <span className="font-mono">{payment.reference}</span> : 'no reference'}
                          </p>
                        </td>
                        <td>
                          {payment.studentId ? (
                            <>
                              <Link to={`/admin/learners/${payment.studentId.id}`} className="block whitespace-nowrap font-medium text-ink-900 hover:text-primary-700">
                                {payment.studentId.name}
                              </Link>
                              <button
                                type="button"
                                onClick={() => setFilter('studentId', payment.studentId.id)}
                                className="whitespace-nowrap text-[11.5px] font-medium text-primary-600 hover:underline"
                              >
                                Payment history
                              </button>
                            </>
                          ) : (
                            <span className="text-ink-400">Deleted account</span>
                          )}
                        </td>
                        <td className="max-w-[11rem] truncate text-[13px]" title={payment.courseId?.title}>{payment.courseId?.title || 'Deleted course'}</td>
                        <td className="text-right font-semibold tabular-nums text-ink-900">{payment.amount > 0 ? formatMoney(payment.amount) : 'Free'}</td>
                        <td>
                          <div className="flex flex-col items-start gap-1">
                            <PaymentStatus status={payment.status} />
                            {notReflected && <span className="text-[11px] font-semibold text-amber-700">Access missing</span>}
                          </div>
                        </td>
                        <td>
                          {isSuperAdmin ? (
                            <div className="flex justify-end gap-0.5">
                              {payment.status !== 'completed' && (
                                <IconAction label="Mark paid & enrol" onClick={() => onConfirm(payment)} disabled={busy} tone="green" icon={CheckCircle2} />
                              )}
                              {(notReflected || (payment.gateway === 'razorpay' && payment.status !== 'completed')) && (
                                <IconAction
                                  label={notReflected ? 'Retry enrolment' : 'Re-check with Razorpay'}
                                  onClick={() => act(payment, () => retryPayment(payment._id), 'Done.')}
                                  disabled={busy}
                                  icon={RotateCcw}
                                />
                              )}
                              {payment.status === 'pending' && (
                                <IconAction label="Mark failed" onClick={() => onFail(payment)} disabled={busy} tone="red" icon={XCircle} />
                              )}
                              {payment.status !== 'completed' && payment.status !== 'cancelled' && (
                                <IconAction label="Cancel enrolment" onClick={() => onCancel(payment)} disabled={busy} tone="gray" icon={Ban} />
                              )}
                              <IconAction label="Edit reference" onClick={() => onEditReference(payment)} disabled={busy} icon={Pencil} />
                            </div>
                          ) : (
                            <span className="block text-right text-[12px] text-ink-400">View only</span>
                          )}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="hover:bg-transparent">
                          <td colSpan={7} className="bg-ink-50/50">
                            <div className="grid gap-4 py-1 md:grid-cols-[1fr_1.4fr]">
                              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px]">
                                <dt className="text-ink-500">Gateway</dt>
                                <dd className="capitalize text-ink-800">{payment.gateway || 'manual'}</dd>
                                <dt className="text-ink-500">Attempts</dt>
                                <dd className="text-ink-800">{payment.attempts || 1}</dd>
                                <dt className="text-ink-500">Learner email</dt>
                                <dd className="truncate text-ink-800">{payment.studentId?.email || '—'}</dd>
                                <dt className="text-ink-500">Confirmed</dt>
                                <dd className="text-ink-800">{formatDate(payment.confirmedAt, true)}</dd>
                                {payment.gatewayOrderId && (
                                  <>
                                    <dt className="text-ink-500">Order ID</dt>
                                    <dd className="truncate font-mono text-ink-800">{payment.gatewayOrderId}</dd>
                                  </>
                                )}
                                {payment.failureReason && (
                                  <>
                                    <dt className="text-ink-500">Failure</dt>
                                    <dd className="text-red-600">{payment.failureReason}</dd>
                                  </>
                                )}
                              </dl>
                              <ol className="space-y-1.5 border-l-2 border-primary-200 pl-4">
                                {(payment.history || []).map((step, index) => (
                                  <li key={index} className="text-[12px] text-ink-600">
                                    <span className="font-semibold text-primary-800">{formatDate(step.at, true)}</span> — {step.note || step.status}
                                  </li>
                                ))}
                                {!payment.history?.length && <li className="text-[12px] text-ink-400">No history recorded.</li>}
                              </ol>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

const actionTones = {
  blue: 'text-primary-600 hover:bg-primary-50',
  green: 'text-emerald-600 hover:bg-emerald-50',
  red: 'text-red-600 hover:bg-red-50',
  gray: 'text-ink-500 hover:bg-ink-100',
};

function IconAction({ label, icon: Icon, onClick, disabled, tone = 'blue' }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg p-2 transition disabled:opacity-40 ${actionTones[tone]}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
