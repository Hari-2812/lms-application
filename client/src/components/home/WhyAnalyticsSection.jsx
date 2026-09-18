import { useState } from 'react';
import { Play, Sparkles } from 'lucide-react';
import SmartImg from './SmartImg.jsx';

const VIDEO_ID = 'OWfoMZlzozk';

/* Shown until /assets/about/image.png is copied into /public. */
function AboutFallback() {
  return (
    <div className="aa-why__fallback">
      <p className="aa-why__quote">“Be a change you wish to see in world”</p>
      <span className="aa-why__quote-by">— Mahatma Gandhi</span>
      <div className="aa-why__person">
        <div className="aa-why__avatar">S</div>
        <div>
          <h4>Subramani · Data Scientist</h4>
          <ul>
            <li>Chief Data Scientist, Analytics Avenue</li>
            <li>Top AI Speaker</li>
            <li>1,000+ data aspirants empowered</li>
            <li>Chennai, Tamil Nadu, India</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function WhyAnalyticsSection() {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <section className="aa-why" id="about">
      <div className="aa-container aa-why__grid">
        <div>
          <h2 className="aa-h2">
            Why Analytics Avenue for <span>L&amp;D</span>?
          </h2>
          <h4 className="aa-why__highlight">
            <strong>We don't educate analytics</strong>
            We build data experts who automate entire businesses end-to-end through scalable data
            pipelines, intelligent ML &amp; Agentic AI solutions, and automation systems that eliminate
            manual effort while delivering accurate insights and outcomes.
          </h4>
          <p className="aa-why__p">
            <span className="aa-why__p-icon" aria-hidden="true">
              <Sparkles size={18} />
            </span>
            <span>
              A perfect platform for career transition seekers, freshers, unemployed professionals
              looking to restart their careers, and passionate data experts to learn, build real-world
              projects, and unlock new career opportunities.
            </span>
          </p>
        </div>

        <div className="aa-why__media">
          {isPlaying ? (
            <div className="aa-why__video">
              <iframe
                src={`https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1&rel=0`}
                title="Why Analytics Avenue"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          ) : (
            <>
              <SmartImg src="/homepage/mentors/about-sec.png" alt="Subramani, Chief Data Scientist" fallback={<AboutFallback />} />
              <button type="button" className="aa-why__play" onClick={() => setIsPlaying(true)} aria-label="Play video">
                <Play size={28} fill="currentColor" />
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
