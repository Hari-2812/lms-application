import { useMemo } from 'react';
import { resolveMediaUrl } from '../../api/client';
import { useBranding } from '../../context/BrandingContext.jsx';

/**
 * The certificate — one standard Analytics Avenue template, the same markup
 * on screen and on paper.
 *
 * Fixed text (company, tagline, title, issuer) comes from Settings →
 * Certificate template. The dynamic fields:
 *   learner name — the learner's current profile name (`holderName`), falling
 *                  back to the name recorded when the certificate was issued
 *   course name  — the course the certificate was issued for
 *   month & year — the date it is viewed / downloaded
 *
 * Every size is in container units (cqw), so the layout scales as one piece
 * from a dashboard card up to a full A4 page. Printing is driven from
 * outside (usePrintCertificate + the print styles in index.css); this
 * component does not depend on any surrounding layout.
 */

// The artwork is drawn on a 1550 × 1000 grid; the face keeps that ratio.
const W = 1550;
const H = 1000;

const NAVY = '#0b2f86';
const ROYAL = '#1557c9';
const BRIGHT = '#1e7fe3';
const SKY = '#4fa3f2';

const toPoints = (pts) => pts.map((p) => p.join(',')).join(' ');

/**
 * A stripe between the parallel 45° lines x − y = c1 and x − y = c2 (c1 < c2),
 * clipped to the top-right corner.
 */
function topRightBand(c1, c2) {
  return toPoints([
    [c1, 0],
    [Math.min(c2, W), 0],
    [W, Math.max(0, W - c2)],
    [W, W - c1],
  ]);
}

/** The same kind of stripe in the bottom-left corner, where c1 < c2 < 0. */
function bottomLeftBand(c1, c2) {
  return toPoints([
    [0, -c2],
    [H + c2, H],
    [Math.max(0, H + c1), H],
    [0, Math.min(H, -c1)],
  ]);
}

/** Rectangle path with concave (notched) corners — the certificate border. */
function notchedFrame(inset, r) {
  const x0 = inset;
  const y0 = inset;
  const x1 = W - inset;
  const y1 = H - inset;
  return [
    `M ${x0 + r} ${y0}`,
    `H ${x1 - r}`,
    `A ${r} ${r} 0 0 0 ${x1} ${y0 + r}`,
    `V ${y1 - r}`,
    `A ${r} ${r} 0 0 0 ${x1 - r} ${y1}`,
    `H ${x0 + r}`,
    `A ${r} ${r} 0 0 0 ${x0} ${y1 - r}`,
    `V ${y0 + r}`,
    `A ${r} ${r} 0 0 0 ${x0 + r} ${y0}`,
    'Z',
  ].join(' ');
}

function starPath(cx, cy, outer, inner = outer * 0.45, points = 5) {
  const step = Math.PI / points;
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + i * step;
    d += `${i ? 'L' : 'M'} ${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)} `;
  }
  return `${d}Z`;
}

/** The completion seal: scalloped rim, laurel, stars and the three-line legend. */
function Seal() {
  const { rim, leaves } = useMemo(() => {
    // A circle with 30 soft scallops.
    let d = '';
    for (let i = 0; i <= 360; i++) {
      const t = (i / 360) * Math.PI * 2;
      const r = 94 + 3.2 * Math.cos(30 * t);
      d += `${i ? 'L' : 'M'} ${(100 + r * Math.cos(t)).toFixed(2)} ${(100 + r * Math.sin(t)).toFixed(2)} `;
    }

    // A laurel branch up each side: seven leaves from near the bottom of
    // the ring to the upper side. θ is measured clockwise from the top.
    const sideLeaves = [];
    for (const side of [1, -1]) {
      for (let i = 0; i < 7; i++) {
        const theta = side > 0 ? 158 - i * 15 : 202 + i * 15;
        const a = (theta * Math.PI) / 180;
        const x = 100 + 63 * Math.sin(a);
        const y = 100 - 63 * Math.cos(a);
        // Along the ring, tipped outwards like a leaf on a stem.
        const rotate = theta + (side > 0 ? -28 : 28);
        sideLeaves.push({ x, y, rotate });
      }
    }
    return { rim: `${d}Z`, leaves: sideLeaves };
  }, []);

  return (
    <svg viewBox="0 0 200 200" className="aa-cert__seal" aria-hidden="true">
      <path d={rim} fill="#eef5fd" stroke={ROYAL} strokeWidth="1.6" />
      <circle cx="100" cy="100" r="82" fill="none" stroke={ROYAL} strokeWidth="1" />
      <circle cx="100" cy="100" r="76" fill="#ffffff" stroke={ROYAL} strokeWidth="2.2" />
      {leaves.map((leaf, i) => (
        <ellipse
          key={i}
          cx={leaf.x}
          cy={leaf.y}
          rx="7.2"
          ry="2.9"
          fill={ROYAL}
          transform={`rotate(${leaf.rotate} ${leaf.x} ${leaf.y})`}
        />
      ))}
      {[-17, 0, 17].map((dx, i) => (
        <path key={`t${i}`} d={starPath(100 + dx, i === 1 ? 50 : 54, i === 1 ? 6 : 4.2)} fill={NAVY} />
      ))}
      {[-17, 0, 17].map((dx, i) => (
        <path key={`b${i}`} d={starPath(100 + dx, i === 1 ? 150 : 146, i === 1 ? 6 : 4.2)} fill={NAVY} />
      ))}
      <g fill={ROYAL} fontFamily="Inter, 'Segoe UI', Arial, sans-serif" fontWeight="800" fontSize="12.5" textAnchor="middle">
        <text x="100" y="87">COURSE</text>
        <text x="100" y="104">COMPLETION</text>
        <text x="100" y="121">CERTIFICATE</text>
      </g>
    </svg>
  );
}

/** "OCTOBER 2026" — from the moment the certificate is viewed or downloaded. */
function monthYear(date = new Date()) {
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase();
}

/** Shrinks a line's font size as it gets longer, so long names stay on one line. */
function fitted(base, text, comfortable) {
  const length = String(text || '').length;
  return length > comfortable ? Math.max(base * 0.55, (base * comfortable) / length) : base;
}

export default function CertificateFace({ certificate, className = '' }) {
  const { branding, certificate: template } = useBranding();

  const name = certificate.holderName || certificate.recipientName || 'Learner Name';
  const course = certificate.courseTitle || 'Course Name';
  const isSample = certificate.kind === 'sample';

  const [firstWord, ...restWords] = (template.companyName || '').split(' ');
  const titleWords = (template.title || 'Course Completion Certificate').trim().split(/\s+/);
  const titleTop = titleWords.length > 1 ? titleWords.slice(0, -1).join(' ') : titleWords[0];
  const titleBottom = titleWords.length > 1 ? titleWords[titleWords.length - 1] : '';

  const logo = branding.logoUrl ? resolveMediaUrl(branding.logoUrl) : '/logos/logo.svg';

  return (
    <div className={`aa-cert ${className}`}>
      <div className="aa-cert__page">
        {/* --- artwork: background lines, border, corner stripes ---------- */}
        <svg className="aa-cert__art" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <rect width={W} height={H} fill="#fbfcfe" />
          <g fill="none" stroke="#c9daf2" strokeWidth="1" opacity="0.55">
            {Array.from({ length: 7 }, (_, i) => (
              <path key={`w${i}`} d={`M 40 ${290 + i * 18} C 260 ${200 + i * 18}, 380 ${420 + i * 18}, 620 ${330 + i * 18}`} />
            ))}
            {Array.from({ length: 6 }, (_, i) => (
              <path key={`a${i}`} d={`M ${1000 + i * 22} 30 C ${1080 + i * 22} 140, ${1180 + i * 22} 160, ${1300 + i * 22} 120`} />
            ))}
          </g>

          <path d={notchedFrame(20, 30)} fill="none" stroke={ROYAL} strokeWidth="3" />
          <path d={notchedFrame(31, 24)} fill="none" stroke={BRIGHT} strokeWidth="1.2" opacity="0.8" />

          {/* top-right stripes */}
          <polygon points={topRightBand(1135, 1175)} fill={SKY} />
          <polygon points={topRightBand(1190, 1300)} fill={NAVY} />
          <polygon points={topRightBand(1300, 1385)} fill={ROYAL} />
          <polygon points={topRightBand(1400, 1460)} fill={BRIGHT} />
          <polygon points={topRightBand(1460, 1600)} fill={NAVY} />

          {/* bottom-left stripes */}
          <polygon points={bottomLeftBand(-610, -570)} fill={SKY} />
          <polygon points={bottomLeftBand(-720, -625)} fill={BRIGHT} />
          <polygon points={bottomLeftBand(-820, -720)} fill={NAVY} />
          <polygon points={bottomLeftBand(-900, -835)} fill={ROYAL} />
          <polygon points={bottomLeftBand(-1100, -900)} fill={NAVY} />
        </svg>

        {isSample && (
          <span className="aa-cert__watermark" aria-hidden="true">
            SAMPLE
          </span>
        )}

        {/* --- brand block --------------------------------------------- */}
        <div className="aa-cert__brand">
          <img src={logo} alt="" className="aa-cert__logo" />
          <div>
            <p className="aa-cert__company">
              <span className="aa-cert__company-first">{firstWord}</span>
              {restWords.length > 0 && ` ${restWords.join(' ')}`}
            </p>
            {template.tagline && <p className="aa-cert__tagline">{template.tagline}</p>}
          </div>
        </div>

        <Seal />

        {/* --- body --------------------------------------------------- */}
        <div className="aa-cert__body">
          <p className="aa-cert__title">{titleTop}</p>
          {titleBottom && (
            <p className="aa-cert__subtitle">
              <span className="aa-cert__rule aa-cert__rule--end" />
              <span className="aa-cert__subtitle-text">{titleBottom}</span>
              <span className="aa-cert__rule aa-cert__rule--start" />
            </p>
          )}

          <p className="aa-cert__certify">This is to certify that</p>

          <p className="aa-cert__name-row">
            <span className="aa-cert__rule aa-cert__rule--both aa-cert__rule--long" />
            <span className="aa-cert__name" style={{ fontSize: `${fitted(4.4, name, 22)}cqw` }}>
              {name}
            </span>
            <span className="aa-cert__rule aa-cert__rule--both aa-cert__rule--long" />
          </p>

          <p className="aa-cert__completed">has successfully completed the</p>
          <p className="aa-cert__course" style={{ fontSize: `${fitted(2.55, course, 40)}cqw` }}>
            {course}
          </p>
          <p className="aa-cert__course-label">Course</p>
          <p className="aa-cert__offered">
            offered by <strong>{template.companyName}</strong>
          </p>
          <p className="aa-cert__recognition">
            In recognition of your dedication, hard work and commitment to enhancing your skills and
            knowledge in {course}.
          </p>

          <div className="aa-cert__block aa-cert__block--date">
            <p className="aa-cert__month">{monthYear()}</p>
            <p className="aa-cert__caption">Month &amp; Year</p>
          </div>

          <div className="aa-cert__block aa-cert__block--issuer">
            <p className="aa-cert__issuer">{template.issuerName}</p>
            {template.issuerTitle && <p className="aa-cert__issuer-title">{template.issuerTitle}</p>}
            {template.issuerRole && <p className="aa-cert__issuer-title">{template.issuerRole}</p>}
          </div>
        </div>

        {certificate.serial && <p className="aa-cert__serial">Certificate ID: {certificate.serial}</p>}
      </div>
    </div>
  );
}
