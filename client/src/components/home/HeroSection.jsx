import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useBranding } from '../../context/BrandingContext.jsx';
import { resolveMediaUrl } from '../../api/client';
import { safeExternalUrl } from '../../utils/url.js';
import SmartImg from './SmartImg.jsx';
import EnquiryModal from './EnquiryModal.jsx';
// Files in /public are served from the site root — reference them by URL, don't import them.
const defaultHeroImage = '/homepage/mentors/mentooors1.jpeg';

const points = ['Data Analytics', 'Data Engineering', 'BI', 'Machine Learning', 'Statistics', 'Agentic AI'];

export default function HeroSection() {
  const { isAuthenticated } = useAuth();
  const { homepage } = useBranding();
  const [enquiryOpen, setEnquiryOpen] = useState(false);

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
            <button type="button" onClick={() => setEnquiryOpen(true)} className="aa-hero__cta">
              Enroll Now <span aria-hidden="true">&gt;</span>
            </button>
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
