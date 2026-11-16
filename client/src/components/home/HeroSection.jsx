import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { GraduationCap, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useBranding } from '../../context/BrandingContext.jsx';
import { resolveMediaUrl } from '../../api/client';
import { safeExternalUrl } from '../../utils/url.js';
import SmartImg from './SmartImg.jsx';
import EnquiryModal from './EnquiryModal.jsx';

// The Enroll Now form opens by itself shortly after the homepage loads: once
// per browser session (closing it and coming back to the homepage does not
// reopen it), and not for people who are already signed in.
//
// A link to /?enroll=1 (the "Enroll Now" button on analyticsavenue.in) always
// opens it straight away — the visitor clicked to enrol — and the parameter is
// then removed from the address bar so a reload does not reopen it.
const AUTO_OPEN_KEY = 'aa.enquiryAutoShown';
const AUTO_OPEN_DELAY_MS = 1000;
const LINKED_OPEN_DELAY_MS = 300;

// Files in /public are served from the site root — reference them by URL, don't import them.
const defaultHeroImage = '/homepage/mentors/mentooors1.jpeg';

const points = ['Data Analytics', 'Data Engineering', 'BI', 'Machine Learning', 'Statistics', 'Agentic AI'];

export default function HeroSection() {
  const { isAuthenticated } = useAuth();
  const { homepage } = useBranding();
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [params, setParams] = useSearchParams();
  const linked = params.get('enroll') === '1';

  useEffect(() => {
    if (!linked) {
      if (isAuthenticated) return undefined;
      try {
        if (sessionStorage.getItem(AUTO_OPEN_KEY)) return undefined;
      } catch {
        /* storage blocked: show it anyway */
      }
    }
    const timer = setTimeout(() => {
      setEnquiryOpen(true);
      try {
        sessionStorage.setItem(AUTO_OPEN_KEY, '1');
      } catch {
        /* storage blocked: it may show again on the next visit to the homepage */
      }
      if (linked) {
        const next = new URLSearchParams(params);
        next.delete('enroll');
        setParams(next, { replace: true });
      }
    }, linked ? LINKED_OPEN_DELAY_MS : AUTO_OPEN_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- params/setParams change with the URL; `linked` covers it
  }, [isAuthenticated, linked]);

  // The right-hand image is set in Admin → LMS settings → Homepage, e.g. for an
  // upcoming event, and can link to that event's page.
  const heroImage = homepage.heroImageUrl ? resolveMediaUrl(homepage.heroImageUrl) : defaultHeroImage;
  const heroLink = safeExternalUrl(homepage.heroImageLink);
  const photo = (
    <SmartImg
      key={heroImage}
      src={heroImage}
      alt={homepage.heroImageAlt || 'Analytics Avenue'}
      loading="eager"
      fallback={
        <div className="aa-hero__photo-fallback">
          <GraduationCap size={120} strokeWidth={1.2} />
        </div>
      }
    />
  );

  return (
    <section className="aa-hero">
      <div className="aa-hero__bg" aria-hidden="true" />

      <div className="aa-hero__inner aa-container">
        <div className="aa-hero__content">
          <a href="https://analyticsavenue.in/" className="aa-hero__pill">
            Powered By Analytics Avenue
          </a>
          <h1 className="aa-hero__title">
            Build Your AI Portfolio like <br /> Top 5% Data Experts
          </h1>
          <p className="aa-hero__p">Rebuild the projects worked by data experts across 10+ domains</p>

          <ul className="aa-hero__list">
            {points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>

          <div className="aa-hero__ctas">
            {/* /dashboard is protected: signed-out visitors go to /login and come back here after. */}
            <Link to="/dashboard" className="aa-hero__cta is-secondary">
              <LayoutDashboard size={18} aria-hidden="true" />
              {isAuthenticated ? 'Go to Dashboard' : 'Login to Dashboard'}
            </Link>
          </div>
        </div>
      </div>

      <div className="aa-hero__photo">
        {heroLink ? (
          <a href={heroLink} target="_blank" rel="noopener noreferrer" aria-label={homepage.heroImageAlt || 'Open announcement'}>
            {photo}
          </a>
        ) : (
          photo
        )}
      </div>

      <EnquiryModal open={enquiryOpen} onClose={() => setEnquiryOpen(false)} />
    </section>
  );
}
