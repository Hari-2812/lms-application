import { Link } from 'react-router-dom';
import { GraduationCap, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import SmartImg from './SmartImg.jsx';
// Files in /public are served from the site root — reference them by URL, don't import them.
const herosecimg = '/homepage/mentors/mentooors1.jpeg';

const points = ['Data Analytics', 'Data Engineering', 'BI', 'Machine Learning', 'Statistics', 'Agentic AI'];

export default function HeroSection() {
  const { isAuthenticated } = useAuth();
  const scrollToPrograms = (e) => {
    e.preventDefault();
    document.getElementById('liveBatchesSection')?.scrollIntoView({ behavior: 'smooth' });
  };

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

          {/* Items fade in one by one, 1s apart (replaces the old DOM typing script). */}
          <ul className="aa-hero__list">
            {points.map((point, i) => (
              <li key={point} style={{ animationDelay: `${i}s` }}>
                {point}
              </li>
            ))}
          </ul>

          <div className="aa-hero__ctas">
            <a href="#liveBatchesSection" onClick={scrollToPrograms} className="aa-hero__cta">
              Explore All Programs <span aria-hidden="true">&gt;</span>
            </a>
            {/* /dashboard is protected: signed-out visitors go to /login and come back here after. */}
            <Link to="/dashboard" className="aa-hero__cta is-secondary">
              <LayoutDashboard size={18} aria-hidden="true" />
              {isAuthenticated ? 'Go to Dashboard' : 'Login to LMS Dashboard'}
            </Link>
          </div>
        </div>
      </div>

      <div className="aa-hero__photo">
        <SmartImg
          src={herosecimg}
          alt="Analytics Avenue data expert"
          loading="eager"
          fallback={
            <div className="aa-hero__photo-fallback">
              <GraduationCap size={120} strokeWidth={1.2} />
            </div>
          }
        />
      </div>
    </section>
  );
}
