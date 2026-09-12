import {
  Award,
  Bell,
  Compass,
  FileText,
  Lock,
  PlayCircle,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import { usePageMeta } from '../components/layout/DashboardLayout.jsx';

const steps = [
  {
    icon: UserPlus,
    title: 'Create your free account',
    body: 'Sign up in seconds with your email. No credit card required to start browsing the catalogue.',
  },
  {
    icon: Compass,
    title: 'Browse the catalogue',
    body: 'Explore every course on the platform — filter by level, search by topic, and see what each course covers before you commit.',
  },
  {
    icon: Lock,
    title: 'Get access from your instructor',
    body: 'Your admin or instructor grants you access to the courses you need. Once granted, a course moves from "restricted" to fully unlocked in My Courses.',
  },
  {
    icon: PlayCircle,
    title: 'Learn at your own pace',
    body: 'Work through short, structured video lessons whenever it suits you. Pick up exactly where you left off — every course remembers your position.',
  },
  {
    icon: TrendingUp,
    title: 'Track your progress',
    body: 'A live progress bar on every course and lesson shows exactly how far you\'ve come, right down to the percentage watched.',
  },
  {
    icon: Bell,
    title: 'Stay in the loop',
    body: 'Get notified the instant you\'re granted access to a new course, a new lesson is added, or you hit a milestone — no need to keep checking back.',
  },
  {
    icon: FileText,
    title: 'Study with the resources provided',
    body: 'Each course comes with downloadable study materials and PDFs under Resources, so you can review offline between lessons.',
  },
  {
    icon: Award,
    title: 'Finish and get recognised',
    body: 'Complete every lesson in a course and it\'s marked done — see your finished courses on the Certificates page.',
  },
];

export default function HowItWorksPage() {
  usePageMeta('How It Works', 'A quick tour of how learning on this platform works, start to finish.');

  return (
    <div className="space-y-8">
      <section className="card overflow-hidden">
        <div className="bg-gradient-to-br from-ink-900 via-ink-900 to-primary-900 px-6 py-10 sm:px-8">
          <p className="eyebrow text-primary-300">Getting started</p>
          <h1 className="mt-3 max-w-2xl text-2xl font-bold leading-tight text-white sm:text-[1.75rem]">
            Everything you need to know about learning here
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-300">
            From signing up to earning a certificate — here's exactly how the whole journey works.
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-base font-semibold text-ink-900">Your learning journey</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step.title} className="card relative p-5">
              <span className="absolute right-4 top-4 text-xs font-bold text-ink-200">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary-50 text-primary-600">
                <step.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-3 text-sm font-semibold text-ink-900">{step.title}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-base font-semibold text-ink-900">Frequently asked questions</h2>
        <div className="mt-4 divide-y divide-ink-100">
          {[
            {
              q: 'Do I have to pay for every course?',
              a: 'Access is managed by your admin or instructor rather than a per-course checkout — once they grant you a course, it\'s yours to keep learning from.',
            },
            {
              q: 'What does "Access restricted" mean on a course?',
              a: 'It means you can see the course in the catalogue but haven\'t been granted access yet. Reach out to your admin and they can unlock it for you from their dashboard.',
            },
            {
              q: 'Can I learn on my phone?',
              a: 'Yes — the whole platform, including the video player and progress tracking, is fully responsive.',
            },
            {
              q: 'Will I be notified about new lessons?',
              a: 'Yes. Once you have access to a course, you\'ll get a real-time notification the moment a new lesson or study material is added to it.',
            },
          ].map((item) => (
            <div key={item.q} className="py-4 first:pt-0 last:pb-0">
              <p className="text-sm font-semibold text-ink-900">{item.q}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{item.a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
