import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Loader2, X } from 'lucide-react';

/**
 * Building blocks shared by every admin page: a plain page title, white
 * panels, simple stat cards and consistent status pills. Blue is kept for
 * actions, links and active states — no gradients or decorative icon tiles.
 *
 * `icon` props are accepted (callers pass them) but deliberately not drawn.
 */

/** Title block at the top of an admin page. */
export function PageHeader({ title, description, actions, children }) {
  return (
    <header>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-ink-900">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-[13.5px] leading-relaxed text-ink-500">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

/** White card with an optional title row. */
export function Panel({ title, description, actions, children, className = '', bodyClassName = 'p-5 sm:p-6', id }) {
  return (
    <section id={id} className={`admin-card scroll-mt-24 overflow-hidden ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-ink-900">{title}</h2>
            {description && <p className="mt-0.5 text-[12.5px] text-ink-500">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

// Only warning states colour the number; everything else stays neutral.
const statValueTones = {
  amber: 'text-amber-600',
  red: 'text-red-600',
};

/** One headline number: label, value, optional hint. */
export function StatTile({ label, value, hint, to, tone }) {
  const body = (
    <>
      <p className="text-[13px] text-ink-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold leading-none tabular-nums ${statValueTones[tone] || 'text-ink-900'}`}>
        {value}
      </p>
      {hint && <p className="mt-2 text-[12px] text-ink-400">{hint}</p>}
    </>
  );

  const classes = `block admin-card p-5 ${to ? 'transition hover:border-primary-300' : ''}`;

  if (to) {
    return (
      <Link to={to} className={classes} aria-label={`${label}: ${value}`}>
        {body}
      </Link>
    );
  }
  return <article className={classes}>{body}</article>;
}

const alertTones = {
  error: { box: 'border-red-200 bg-red-50 text-red-700', icon: AlertCircle },
  success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  info: { box: 'border-primary-200 bg-primary-50 text-primary-800', icon: Info },
  warning: { box: 'border-amber-200 bg-amber-50 text-amber-800', icon: AlertTriangle },
};

export function Alert({ tone = 'info', children, onClose, className = '' }) {
  if (!children) return null;
  const { box, icon: Icon } = alertTones[tone] || alertTones.info;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-[13.5px] ${box} ${className}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Dismiss" className="rounded p-0.5 opacity-70 transition hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/**
 * Page-level success/error banner state. Success messages clear themselves
 * after a few seconds; errors stay until dismissed or replaced.
 */
export function useFlash() {
  const [flash, setFlash] = useState({ tone: null, message: '' });
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const show = useCallback((tone, message) => {
    clearTimeout(timer.current);
    setFlash({ tone, message });
    if (tone === 'success') timer.current = setTimeout(() => setFlash({ tone: null, message: '' }), 5000);
  }, []);

  const clear = useCallback(() => setFlash({ tone: null, message: '' }), []);

  const node = flash.message ? (
    <Alert tone={flash.tone} onClose={clear}>
      {flash.message}
    </Alert>
  ) : null;

  return {
    node,
    success: useCallback((m) => show('success', m), [show]),
    error: useCallback((m) => show('error', m), [show]),
    clear,
  };
}

const pillTones = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/15',
  blue: 'bg-primary-50 text-primary-700 ring-primary-600/15',
  gray: 'bg-ink-50 text-ink-600 ring-ink-500/15',
};

export function Pill({ tone = 'gray', children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${pillTones[tone] || pillTones.gray} ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
      {children}
    </span>
  );
}

export const PAYMENT_STATUS = {
  completed: { label: 'Successful', tone: 'green' },
  pending: { label: 'Pending', tone: 'amber' },
  failed: { label: 'Failed', tone: 'red' },
  cancelled: { label: 'Cancelled', tone: 'gray' },
};

export function PaymentStatus({ status }) {
  const meta = PAYMENT_STATUS[status] || { label: status, tone: 'gray' };
  return <Pill tone={meta.tone}>{meta.label}</Pill>;
}

export function AccountStatus({ status }) {
  return status === 'suspended' ? <Pill tone="red">Suspended</Pill> : <Pill tone="green">Active</Pill>;
}

/** Accessible on/off switch with a label and description. */
export function Toggle({ id, label, description, checked, onChange, disabled = false }) {
  return (
    <div className="flex items-start justify-between gap-6 py-3.5">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-ink-900">
          {label}
        </label>
        {description && <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-500">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${checked ? 'bg-primary-600' : 'bg-ink-200'}`}
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

export function LoadingRow({ label = 'Loading…', className = '' }) {
  return (
    <div className={`flex items-center gap-2 p-6 text-sm text-ink-500 ${className}`}>
      <Loader2 className="h-4 w-4 animate-spin text-primary-500" aria-hidden="true" /> {label}
    </div>
  );
}

export function EmptyRow({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {Icon && <Icon className="h-6 w-6 text-ink-300" aria-hidden="true" />}
      <p className="mt-3 text-sm font-semibold text-ink-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-ink-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Row of filter controls above a table. */
export function FilterBar({ children }) {
  return <div className="flex flex-col gap-3 border-b border-ink-100 bg-white px-5 py-4 sm:px-6 lg:flex-row lg:flex-wrap lg:items-end">{children}</div>;
}

export function FilterField({ label, children, className = '' }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className="text-[12px] font-medium text-ink-600">{label}</span>
      {children}
    </label>
  );
}

/** Small read-only notice shown to Support / Reviewer accounts. */
export function ReadOnlyNotice({ children = 'You have view-only access here. A Super Admin can make changes.' }) {
  return <Alert tone="info">{children}</Alert>;
}

// --- formatting ------------------------------------------------------------

export const formatMoney = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;

const METHOD_LABELS = {
  upi: 'UPI',
  card: 'Card',
  netbanking: 'Net banking',
  'bank-transfer': 'Bank transfer',
  razorpay: 'Razorpay',
  free: 'Free',
  manual: 'Manual',
};
export const formatMethod = (method) => METHOD_LABELS[method] || method || '—';

export function formatDate(value, withTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function timeAgo(value) {
  if (!value) return '—';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

/** Initials avatar in the admin palette. */
export function Initials({ name = '', size = 'md' }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  const sizes = { sm: 'h-8 w-8 text-[11px]', md: 'h-10 w-10 text-[13px]', lg: 'h-16 w-16 text-lg' };
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-primary-100 font-semibold text-primary-800 ${sizes[size] || sizes.md}`}>
      {initials || '?'}
    </span>
  );
}

/** Segmented tabs in the admin palette (WAI-ARIA tab pattern, arrow keys). */
export function AdminTabs({ tabs, value, onChange, className = '' }) {
  const onKeyDown = (event) => {
    const index = tabs.findIndex((t) => t.value === value);
    let next = null;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    if (next !== null) {
      event.preventDefault();
      onChange(tabs[next].value);
    }
  };

  return (
    <div role="tablist" onKeyDown={onKeyDown} className={`inline-flex flex-wrap gap-1 rounded-xl bg-primary-50 p-1 ${className}`}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        const Icon = tab.icon;
        return (
          <button
            key={tab.value}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.value)}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition ${
              active ? 'bg-white text-primary-700 shadow-sm' : 'text-primary-900/60 hover:text-primary-800'
            }`}
          >
            {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
            {tab.label}
            {typeof tab.count === 'number' && (
              <span className={`rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${active ? 'bg-primary-600 text-white' : 'bg-white/70 text-primary-700'}`}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Thin blue progress bar with the percentage beside it. */
export function ProgressMeter({ value = 0, label }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-2 w-full min-w-[5rem] overflow-hidden rounded-full bg-primary-50" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full rounded-full bg-primary-600" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 shrink-0 text-right text-[12px] font-semibold tabular-nums text-primary-700">{pct}%</span>
    </div>
  );
}
