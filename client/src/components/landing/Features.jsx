import { GraduationCap, LineChart, MonitorSmartphone, Wrench } from 'lucide-react';
import Reveal from '../common/Reveal.jsx';
import SectionHeading from '../common/SectionHeading.jsx';

const features = [
  {
    icon: GraduationCap,
    title: 'Learn from experts',
    body: 'Every course is authored by someone who builds with the tools daily, not summarised from documentation.',
  },
  {
    icon: Wrench,
    title: 'Practical learning',
    body: 'Lessons are short and ordered, each one moving a real project forward instead of covering theory in isolation.',
  },
  {
    icon: LineChart,
    title: 'Track your progress',
    body: 'Playback position, completed lessons and course percentage are saved automatically as you watch.',
  },
  {
    icon: MonitorSmartphone,
    title: 'Learn anytime',
    body: 'The player, dashboard and curriculum are fully responsive, from a phone on the commute to a desktop monitor.',
  },
];

export default function Features() {
  return (
    <section id="why" className="section scroll-mt-20 bg-surface-muted">
      <div className="container">
        <Reveal>
          <SectionHeading
            eyebrow="Why choose us"
            title="Built around how people actually learn"
            description="Four things we got right so that finishing a course feels achievable."
            align="center"
          />
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, body }, index) => (
            <Reveal key={title} delay={index * 0.06}>
              <article className="card h-full p-6 transition duration-300 hover:border-ink-200 hover:shadow-card-hover">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-50 text-primary-600">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-[15px] font-semibold text-ink-900">{title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-600">{body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
