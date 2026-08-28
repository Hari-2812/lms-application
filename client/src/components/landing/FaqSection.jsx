import { Plus } from 'lucide-react';
import Reveal from '../common/Reveal.jsx';
import SectionHeading from '../common/SectionHeading.jsx';
import { faqs } from '../../content/resources.js';

/** Native <details> accordion — keyboard accessible with no extra JavaScript. */
export default function FaqSection() {
  return (
    <section id="faq" className="section scroll-mt-20 bg-surface-muted">
      <div className="container max-w-3xl">
        <Reveal>
          <SectionHeading
            eyebrow="FAQ"
            title="Frequently asked questions"
            description="Everything students usually want to know before starting."
            align="center"
          />
        </Reveal>

        <div className="mt-10 space-y-3">
          {faqs.map((item, index) => (
            <Reveal key={item.q} delay={index * 0.05}>
              <details className="card group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold text-ink-900">
                  {item.q}
                  <Plus
                    className="h-4 w-4 shrink-0 text-ink-400 transition duration-300 group-open:rotate-45"
                    aria-hidden="true"
                  />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-ink-600">{item.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
