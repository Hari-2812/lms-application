import SmartImg from './SmartImg.jsx';

const IMG = '/homepage/testimonials/';

// White-on-transparent logos, so both rows use dark tiles.
const track1 = [
  { img: 'marqueess1.png', name: 'JCPenney' },
  { img: 'marqueess2.png', name: 'Microsoft' },
  { img: 'marqueess3.png', name: 'Google' },
  { img: 'marqueess4.png', name: 'Sony' },
  { img: 'marqueess5.png', name: 'Walmart' },
  { img: 'marqueess6.png', name: 'Hindustan Times' },
];

const track2 = [
  { img: 'marqueess7.png', name: 'Neiman Marcus Group' },
  { img: 'marqueess8.png', name: 'Signant Health' },
  { img: 'marqueess9.png', name: 'Kellanova' },
  { img: 'marqueess10.png', name: 'Myntra' },
  { img: 'marqueess11.png', name: 'Amazon' },
  { img: 'marqueess12.png', name: 'Centuryply' },
  { img: 'marqueess13.png', name: 'TATA 1mg' },
];

function Marquee({ logos, reverse = false }) {
  // Rendered twice; the track slides by exactly -50% for a seamless loop.
  const loop = [...logos, ...logos];
  return (
    <div className={`aa-marquee ${reverse ? 'is-reverse' : ''}`}>
      <div className="aa-marquee__track">
        {loop.map((logo, i) => (
          <div className="aa-logo" key={i} aria-hidden={i >= logos.length}>
            <SmartImg
              src={IMG + logo.img}
              alt={logo.name}
              fallback={<span className="aa-logo__text">{logo.name}</span>}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WorkingCompaniesSection() {
  return (
    <section className="aa-companies">
      <div className="aa-container">
        <h2 className="aa-h2">
          Aspirants Working With <span>Top Companies</span> Like
        </h2>
      </div>
      <Marquee logos={track1} />
      <Marquee logos={track2} reverse />
    </section>
  );
}
