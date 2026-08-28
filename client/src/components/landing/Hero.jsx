import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, CheckCircle2, PlayCircle, Sparkles } from 'lucide-react';
import Button from '../common/Button.jsx';
import ProgressBar from '../common/ProgressBar.jsx';

const fade = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
};

const ease = [0.22, 1, 0.36, 1];

/**
 * Landing hero. Stats are read from the live catalogue, so the numbers are
 * real; when the API is unreachable they render as em-dashes rather than
 * invented figures.
 */
export default function Hero({ stats = [] }) {
  return (
    <section className="relative overflow-hidden bg-mesh">
      <div className="pointer-events-none absolute inset-0 bg-grid [mask-image:radial-gradient(60%_50%_at_50%_0%,black,transparent)]" />

      <div className="container relative grid items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-24">
        <motion.div initial="hidden" animate="show" transition={{ staggerChildren: 0.08 }}>
          <motion.p
            variants={fade}
            transition={{ duration: 0.5, ease }}
            className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-primary-700 backdrop-blur"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Learn. Grow. Succeed.
          </motion.p>

          <motion.h1
            variants={fade}
            transition={{ duration: 0.5, ease }}
            className="mt-6 text-[2.25rem] leading-[1.1] tracking-[-0.03em] sm:text-display lg:text-display-lg"
          >
            Build your skills.
            <br />
            <span className="text-primary-700">Shape your future.</span>
          </motion.h1>

          <motion.p
            variants={fade}
            transition={{ duration: 0.5, ease }}
            className="mt-6 max-w-xl text-base leading-relaxed text-ink-600 sm:text-[17px]"
          >
            Learn from expert instructors through practical, structured courses designed to help you
            build real-world skills — with every minute of progress saved automatically.
          </motion.p>

          <motion.div
            variants={fade}
            transition={{ duration: 0.5, ease }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <Button to="/courses" size="lg">
              Explore Courses
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button to="/register" variant="secondary" size="lg">
              <PlayCircle className="h-4 w-4" aria-hidden="true" />
              Start Learning
            </Button>
          </motion.div>

          {stats.length > 0 && (
            <motion.dl
              variants={fade}
              transition={{ duration: 0.5, ease }}
              className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-ink-200/70 pt-8"
            >
              {stats.map((stat) => (
                <div key={stat.label}>
                  <dt className="sr-only">{stat.label}</dt>
                  <dd>
                    <span className="block text-2xl font-bold tracking-tight text-ink-900">
                      {stat.value}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-ink-500">{stat.label}</span>
                  </dd>
                </div>
              ))}
            </motion.dl>
          )}
        </motion.div>

        {/* Original abstract composition — a stylised course card, not stock photography. */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease }}
          className="relative mx-auto w-full max-w-md lg:max-w-none"
          aria-hidden="true"
        >
          <div className="absolute -right-6 -top-8 h-40 w-40 rounded-full bg-primary-200/40 blur-2xl" />
          <div className="absolute -bottom-10 -left-6 h-44 w-44 rounded-full bg-primary-300/30 blur-3xl" />

          <div className="relative rounded-2xl border border-ink-100 bg-white p-3 shadow-pop">
            <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-gradient-to-br from-primary-700 via-primary-600 to-primary-500">
              <svg
                className="absolute inset-0 h-full w-full opacity-25"
                viewBox="0 0 400 250"
                preserveAspectRatio="xMidYMid slice"
              >
                <defs>
                  <pattern id="hero-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                    <path d="M32 0H0v32" fill="none" stroke="white" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="400" height="250" fill="url(#hero-grid)" />
                <circle cx="350" cy="40" r="90" fill="white" opacity="0.14" />
                <circle cx="40" cy="220" r="70" fill="white" opacity="0.1" />
              </svg>
              <span className="absolute inset-0 grid place-items-center">
                <span className="grid h-16 w-16 place-items-center rounded-full bg-white/95 shadow-lg">
                  <PlayCircle className="h-8 w-8 text-primary-700" />
                </span>
              </span>
            </div>

            <div className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">
                Web Development
              </p>
              <p className="mt-1 font-semibold text-ink-900">Modern React Development</p>
              <div className="mt-3.5">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-ink-500">Lesson 12 of 18</span>
                  <span className="font-semibold text-ink-900">68%</span>
                </div>
                <ProgressBar value={68} />
              </div>
            </div>
          </div>

          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -bottom-5 -left-5 hidden items-center gap-2.5 rounded-xl border border-ink-100 bg-white px-3.5 py-3 shadow-card sm:flex"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <span className="leading-tight">
              <span className="block text-[13px] font-semibold text-ink-900">Lesson complete</span>
              <span className="block text-[11px] text-ink-500">Progress saved</span>
            </span>
          </motion.div>

          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
            className="absolute -right-5 top-6 hidden items-center gap-2.5 rounded-xl border border-ink-100 bg-white px-3.5 py-3 shadow-card sm:flex"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-50 text-primary-600">
              <BookOpen className="h-4 w-4" />
            </span>
            <span className="leading-tight">
              <span className="block text-[13px] font-semibold text-ink-900">Structured path</span>
              <span className="block text-[11px] text-ink-500">Ordered lessons</span>
            </span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
