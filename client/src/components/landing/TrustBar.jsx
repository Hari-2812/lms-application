import { BarChart3, Boxes, CircuitBoard, Hexagon, Layers, Orbit } from 'lucide-react';
import Reveal from '../common/Reveal.jsx';

/**
 * Lightweight trust strip.
 *
 * These are neutral placeholder marks, not real companies — no partnership is
 * claimed. Swap them for genuine partner logos when there are any.
 */
const placeholders = [
  { name: 'Northpoint', icon: Hexagon },
  { name: 'Layerworks', icon: Layers },
  { name: 'Orbit Labs', icon: Orbit },
  { name: 'Cratebox', icon: Boxes },
  { name: 'Circuitry', icon: CircuitBoard },
  { name: 'Metricly', icon: BarChart3 },
];

export default function TrustBar() {
  return (
    <section className="border-y border-ink-100 bg-surface-muted py-10">
      <div className="container">
        <Reveal>
          <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">
            Trusted by learners and working professionals
          </p>

          <ul className="mt-7 grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3 lg:grid-cols-6">
            {placeholders.map(({ name, icon: Icon }) => (
              <li
                key={name}
                className="flex items-center justify-center gap-2.5 text-ink-400 transition hover:text-ink-600"
              >
                <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                <span className="text-sm font-semibold tracking-tight">{name}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
