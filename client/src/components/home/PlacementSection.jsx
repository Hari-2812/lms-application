// Card centres line up with the connector end-points in the 1000 x 600 SVG.
const modes = [
  {
    title: 'Referral Programs',
    color: 'var(--yellow)',
    top: '13.33%',
    text: 'We have a strong data community channels with 5000+ Professionals through whom we receive job updates regularly.',
  },
  {
    title: 'Organic Job Calls',
    color: 'var(--magenta)',
    top: '50%',
    text: 'We create and set up profiles across nine different secret portals to organically attract placement opportunities.',
  },
  {
    title: 'Internal Project Acquisition',
    color: 'var(--cyan)',
    top: '86.67%',
    text: 'As a growing analytical startup, we acquire projects overseas that provide additional placement opportunities.',
  },
];

export default function PlacementSection() {
  return (
    <section className="aa-placement">
      <div className="aa-container">
        <h2 className="aa-h2">
          3 MODE OF <br />
          <span>Placement opportunities</span>
        </h2>
        <p className="aa-sub aa-placement__quote">
          “Skip the hype. Learn proven strategies to attract organic job calls and crack
          referral-driven hiring”
        </p>

        <div className="aa-stage">
          <svg className="aa-stage__svg" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
            <path className="aa-stage__line is-y" d="M 170 180 C 170 100, 250 80, 450 80" />
            <path className="aa-stage__line is-m" d="M 300 300 L 450 300" />
            <path className="aa-stage__line is-c" d="M 170 420 C 170 500, 250 520, 450 520" />
          </svg>

          <div className="aa-bulb" aria-hidden="true">
            <div className="aa-bulb__head">
              <span className="aa-bulb__text">Hiring</span>
            </div>
            <div className="aa-bulb__neck" />
            <div className="aa-bulb__base" />
          </div>

          {modes.map((mode) => (
            <div key={mode.title} className="aa-stage__card" style={{ '--accent': mode.color, top: mode.top }}>
              <h3>{mode.title}</h3>
              <p>{mode.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
