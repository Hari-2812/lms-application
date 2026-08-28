import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import Logo from '../common/Logo.jsx';

/**
 * Split-screen shell shared by Login and Register: branded education panel on
 * the left (hidden below `lg`), form on the right.
 */
export default function AuthLayout({ title, subtitle, points = [], children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-primary-800 via-primary-700 to-primary-600 p-12 lg:flex lg:flex-col">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-20" aria-hidden="true" />
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-white/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative">
          <Logo tone="light" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative mt-auto max-w-md"
        >
          <h2 className="text-[2rem] leading-tight tracking-tight text-white">
            Learning that remembers where you left off.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-primary-100">
            Structured lessons, secure video delivery and progress tracking that keeps every course
            moving forward.
          </p>

          {points.length > 0 && (
            <ul className="mt-9 space-y-3.5">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-primary-50">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-200" aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
          )}
        </motion.div>

        <p className="relative mt-auto pt-10 text-xs text-primary-200/80">
          &copy; {new Date().getFullYear()} AnalyticsAvenue EduTech
        </p>
      </aside>

      {/* Form panel */}
      <div className="flex flex-col bg-white">
        <div className="flex items-center justify-between p-5 sm:p-6">
          <span className="lg:hidden">
            <Logo />
          </span>
          <Link
            to="/"
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-ink-500 transition hover:text-ink-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to home
          </Link>
        </div>

        <main className="flex flex-1 items-center justify-center px-5 pb-10 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-md"
          >
            <h1 className="text-[1.75rem] tracking-tight">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-ink-600">{subtitle}</p>}

            <div className="mt-8">{children}</div>

            {footer && <div className="mt-8 text-center text-sm text-ink-600">{footer}</div>}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
