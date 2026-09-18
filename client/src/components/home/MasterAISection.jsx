import { useState } from 'react';
import { Cpu, MousePointerClick, X } from 'lucide-react';

/* Flat, full-colour industry icons (48 x 48). */
const icons = {
  manufacturing: (
    <>
      <path d="M5 41V22l10 6v-6l10 6v-6l10 6V9h7v32z" fill="#F97316" />
      {[11, 18, 25, 32].map((x) => (
        <rect key={x} x={x} y="32" width="4" height="4" rx="0.8" fill="#fff" />
      ))}
    </>
  ),
  telecom: (
    <>
      <circle cx="24" cy="24" r="18" fill="#0EA5E9" />
      <circle cx="24" cy="24" r="11" fill="none" stroke="#fff" strokeWidth="1.6" strokeDasharray="22 5" />
      <circle cx="24" cy="24" r="5" fill="#fff" />
    </>
  ),
  battery: (
    <>
      <rect x="19" y="4" width="10" height="5" rx="1.5" fill="#15803D" />
      <rect x="12" y="8" width="24" height="34" rx="5" fill="#16A34A" />
      <path d="M26.5 15 19 27h5.5l-3 9.5L30 24h-5.5l2-9z" fill="#fff" />
    </>
  ),
  ecommerce: (
    <>
      <path d="M17 19v-4a7 7 0 0 1 14 0v4" fill="none" stroke="#D97706" strokeWidth="3" strokeLinecap="round" />
      <rect x="9" y="18" width="30" height="25" rx="5" fill="#FBBF24" />
      <circle cx="19" cy="27" r="1.8" fill="#78350F" />
      <circle cx="29" cy="27" r="1.8" fill="#78350F" />
      <path d="M19 33q5 4.5 10 0" fill="none" stroke="#78350F" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  truck: (
    <>
      <rect x="4" y="13" width="40" height="21" rx="4" fill="#0EA5E9" />
      <rect x="30" y="18" width="8" height="4" rx="1" fill="#fff" />
      <circle cx="13" cy="36" r="4.5" fill="#0F172A" />
      <circle cx="35" cy="36" r="4.5" fill="#0F172A" />
    </>
  ),
  telemetry: (
    <>
      <rect x="10" y="21" width="6" height="16" rx="1.5" fill="#A78BFA" />
      <rect x="21" y="11" width="6" height="26" rx="1.5" fill="#8B5CF6" />
      <rect x="32" y="17" width="6" height="20" rx="1.5" fill="#A78BFA" />
      <circle cx="13" cy="16" r="2" fill="#8B5CF6" />
      <circle cx="35" cy="12" r="2" fill="#8B5CF6" />
      <rect x="7" y="39" width="34" height="3" rx="1.5" fill="#6D28D9" />
    </>
  ),
  healthcare: (
    <>
      <circle cx="24" cy="24" r="19" fill="#EF4444" />
      <rect x="20" y="12" width="8" height="24" rx="2" fill="#fff" />
      <rect x="12" y="20" width="24" height="8" rx="2" fill="#fff" />
    </>
  ),
  car: (
    <>
      <path d="M13 15h22l5 9H8z" fill="#60A5FA" />
      <path d="M5 24h38v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" fill="#1D8CF8" />
      <rect x="9" y="26" width="30" height="3" rx="1.5" fill="#1565C0" />
      <circle cx="14" cy="36" r="4.5" fill="#0F172A" />
      <circle cx="34" cy="36" r="4.5" fill="#0F172A" />
    </>
  ),
  it: (
    <>
      <rect x="5" y="8" width="38" height="26" rx="3" fill="#475569" />
      <rect x="9" y="12" width="30" height="18" rx="1.5" fill="#CBD5E1" />
      <rect x="20" y="17" width="8" height="8" rx="1" fill="#475569" />
      <rect x="21" y="34" width="6" height="5" fill="#475569" />
      <rect x="14" y="39" width="20" height="3" rx="1.5" fill="#475569" />
    </>
  ),
};

// Clockwise from Manufacturing (top). `ring` is that node's segment colour.
// Hiring companies are examples — edit to match your data.
const industries = [
  { name: 'Manufacturing', icon: 'manufacturing', ring: '#22B8CF', companies: ['Siemens', 'Bosch', 'Honeywell', 'L&T', 'Schneider Electric'] },
  { name: 'Telecommunication', icon: 'telecom', ring: '#12A594', companies: ['Ericsson', 'Nokia', 'Jio', 'Airtel', 'Qualcomm'] },
  { name: 'EV & Battery', icon: 'battery', ring: '#B7795C', companies: ['Tesla', 'Tata Motors EV', 'Ola Electric', 'Ather Energy', 'Exide'] },
  { name: 'E-commerce', icon: 'ecommerce', ring: '#F4511E', companies: ['Amazon', 'Flipkart', 'Myntra', 'Meesho', 'Swiggy'] },
  { name: 'Supply Chain', icon: 'truck', ring: '#D6307F', companies: ['Walmart', 'Maersk', 'DHL', 'Delhivery', 'Blue Dart'] },
  { name: 'Telemetry', icon: 'telemetry', ring: '#B04AA8', companies: ['Trimble', 'Geotab', 'Samsara', 'Bosch', 'Continental'] },
  { name: 'Healthcare', icon: 'healthcare', ring: '#6366F1', companies: ['GE Healthcare', 'Philips', 'Apollo', 'Siemens Healthineers', 'IQVIA'] },
  { name: 'Automobile', icon: 'car', ring: '#1E88E5', companies: ['Ford', 'Mercedes-Benz', 'Hyundai', 'Tata Motors', 'Renault Nissan'] },
  { name: 'IT Services', icon: 'it', ring: '#29B6F6', companies: ['TCS', 'Infosys', 'Wipro', 'Accenture', 'Cognizant'] },
];

// Geometry in a 700 x 700 design space.
const VB = 700;
const C = VB / 2;
const RING = 205; // multicolour ring (nodes sit on it)
const INNER = 130; // thin inner ring
const LABEL = 292; // label distance from centre
const SPOKE_FROM = 58;
const SPOKE_TO = RING - 38;
const STEP = 360 / industries.length;
const START = -100; // Manufacturing sits just left of 12 o'clock

const polar = (r, deg) => {
  const a = (deg * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
};
const pct = (v) => `${(v / VB) * 100}%`;

const nodes = industries.map((ind, i) => ({ ...ind, angle: START + i * STEP }));

function arc(r, from, to) {
  const [x1, y1] = polar(r, from);
  const [x2, y2] = polar(r, to);
  return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
}

export default function MasterAISection() {
  const [active, setActive] = useState(null);
  const selected = nodes.find((n) => n.name === active);

  return (
    <section className="aa-master">
      <div className="aa-container">
        <h2 className="aa-h2">
          Mastering AI Multiplies <br /> <span>Your Opportunities</span>
        </h2>
        <p className="aa-sub">
          AI is transforming the world and every industry is investing heavily in it. Not just to grow
          revenue, but to eliminate manual work, generate accurate insights, and drive predictable
          business outcomes
        </p>

        <p className="aa-master__hint">
          <MousePointerClick size={16} /> Click on the icon to view hiring companies
        </p>

        <div className="aa-orbit">
          <svg className="aa-orbit__svg" viewBox={`0 0 ${VB} ${VB}`} aria-hidden="true">
            <defs>
              <radialGradient id="aa-orbit-disc" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#F4EFE6" />
                <stop offset="70%" stopColor="#FAF7F1" />
                <stop offset="100%" stopColor="#FDFBF7" />
              </radialGradient>
            </defs>

            <circle cx={C} cy={C} r={RING} fill="url(#aa-orbit-disc)" />

            {/* Segmented multicolour ring: one arc per node, centred on it */}
            {nodes.map((n) => (
              <path
                key={`arc-${n.name}`}
                d={arc(RING, n.angle - STEP / 2, n.angle + STEP / 2)}
                className="aa-orbit__arc"
                stroke={n.ring}
              />
            ))}

            <circle cx={C} cy={C} r={INNER} className="aa-orbit__inner" />

            {nodes.map((n, i) => {
              const [x1, y1] = polar(SPOKE_FROM, n.angle);
              const [x2, y2] = polar(SPOKE_TO, n.angle);
              const isActive = active === n.name;
              return (
                <g key={`spoke-${n.name}`}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} className={`aa-orbit__spoke ${isActive ? 'is-active' : ''}`} />
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    className="aa-orbit__pulse"
                    style={{ animationDelay: `${(i * 0.37) % 2.4}s` }}
                  />
                </g>
              );
            })}
          </svg>

          <div className="aa-orbit__chip">
            <Cpu strokeWidth={1.8} />
          </div>

          {nodes.map((n) => {
            const [x, y] = polar(RING, n.angle);
            const [lx, ly] = polar(LABEL, n.angle);
            const isActive = active === n.name;
            return (
              <div key={n.name}>
                <button
                  type="button"
                  className={`aa-orbit__node ${isActive ? 'is-active' : ''}`}
                  style={{ left: pct(x), top: pct(y), '--node': n.ring }}
                  onClick={() => setActive(isActive ? null : n.name)}
                  aria-pressed={isActive}
                  aria-label={`${n.name} — view hiring companies`}
                >
                  <svg viewBox="0 0 48 48" aria-hidden="true">
                    {icons[n.icon]}
                  </svg>
                </button>
                <span className="aa-orbit__label" style={{ left: pct(lx), top: pct(ly) }} aria-hidden="true">
                  {n.name}
                </span>
              </div>
            );
          })}
        </div>

        {selected && (
          <div className="aa-orbit__panel" style={{ '--node': selected.ring }} key={selected.name}>
            <div className="aa-orbit__panel-head">
              <h3>Hiring companies · {selected.name}</h3>
              <button type="button" className="aa-orbit__close" onClick={() => setActive(null)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <ul className="aa-orbit__companies">
              {selected.companies.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
