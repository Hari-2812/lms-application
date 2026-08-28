import { ArrowRight, Check, GraduationCap, LineChart, MonitorPlay, Timer } from 'lucide-react';
import Button from '../common/Button.jsx';
import Reveal from '../common/Reveal.jsx';

const highlights = [
  { icon: GraduationCap, label: 'Expert-led courses' },
  { icon: Timer, label: 'Learn at your own pace' },
  { icon: LineChart, label: 'Track your progress' },
  { icon: MonitorPlay, label: 'Learn from anywhere' },
];

/** Two-column "about the platform" band. */
export default function AboutSection({ stats = [] }) {
  return (
    <section id="about" className="section scroll-mt-20">
      <div className="container grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        {/* Original illustrative composition built from the design system. */}
        <Reveal className="order-2 lg:order-1">
          <div className="relative" aria-hidden="true">
            <div className="absolute -left-6 -top-6 h-32 w-32 rounded-full bg-primary-100/70 blur-2xl" />

            <div className="relative grid gap-4 sm:grid-cols-2">
              <div className="card space-y-4 p-6 sm:mt-8">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-600 text-white">
                  <MonitorPlay className="h-5 w-5" />
                </span>
                <p className="text-sm font-semibold text-ink-900">Watch a lesson</p>
                <div className="space-y-2">
                  <div className="h-2 w-full rounded-full bg-ink-100" />
                  <div className="h-2 w-4/5 rounded-full bg-ink-100" />
                  <div className="h-2 w-3/5 rounded-full bg-primary-200" />
                </div>
              </div>

              <div className="card space-y-4 p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500 text-white">
                  <Check className="h-5 w-5" />
                </span>
                <p className="text-sm font-semibold text-ink-900">Mark it complete</p>
                <ul className="space-y-2.5">
                  {[1, 2, 3].map((row) => (
                    <li key={row} className="flex items-center gap-2.5">
                      <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald-100">
                        <Check className="h-2.5 w-2.5 text-emerald-600" />
                      </span>
                      <span className="h-2 flex-1 rounded-full bg-ink-100" />
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card p-6 sm:col-span-2">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-semibold text-ink-900">Course progress</p>
                  <p className="text-sm font-bold text-primary-700">68%</p>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink-100">
                  <div className="h-full w-[68%] rounded-full bg-primary-600" />
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.08} className="order-1 lg:order-2">
          <p className="eyebrow">About our LMS</p>
          <h2 className="mt-3 text-2xl sm:text-display-sm">
            Everything you need to learn with confidence
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-ink-600">
            Courses are broken into short, ordered lessons instead of one long recording, so you
            always know what comes next. Videos stream securely through our own backend, and your
            playback position is saved as you watch — close the tab mid-lesson and pick up on the
            exact second you left off.
          </p>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {highlights.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary-600">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="text-sm font-medium text-ink-800">{label}</span>
              </li>
            ))}
          </ul>

          {stats.length > 0 && (
            <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4 border-t border-ink-100 pt-6">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <dt className="text-[13px] text-ink-500">{stat.label}</dt>
                  <dd className="text-xl font-bold text-ink-900">{stat.value}</dd>
                </div>
              ))}
            </dl>
          )}

          <Button to="/courses" className="mt-8">
            Discover More
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </Reveal>
      </div>
    </section>
  );
}
