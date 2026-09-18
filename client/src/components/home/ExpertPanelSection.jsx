import { Quote } from 'lucide-react';
import SmartImg from './SmartImg.jsx';

const IMG = '/homepage/mentors/';

// Rows mirror the original layout: 1 → 2 → 2 → 3 cards.
const rows = [
  [
    { name: 'Subramani', role: 'Chief Data Scientist', img: 'mentooors1.jpeg', desc: 'Worked with 15+ international brands, honored as a Top AI Speaker for outstanding contributions to AI education and industry adoption, and empowered 1,000+ data aspirants through focused AI and data analytics initiatives.', skills: ['B2B Consultations', 'Business development', 'Data Engineering', 'Data Science', 'SQL', 'GenAI'] },
  ],
  [
    { name: 'Nishanth', role: 'Senior Data Engineer', img: 'mentooors3.jpeg', desc: 'With 8+ years of experience in designing and maintaining scalable data pipelines and architectures across multiple cloud platforms through data engineering', skills: ['Building optimised data pipelines', 'Data Engineering', 'DBT', 'Snowflake', 'Cloud computing'] },
    { name: 'Prasanna', role: 'Senior BI-Developer', img: 'mentooors4.jpg', desc: 'Builds predictive dashboards and data models to deliver actionable insights and accurate decisions for various global brands with 5+ years of experience', skills: ['AWS', 'GCP', 'SQL', 'Power BI', 'Databricks'] },
  ],
  [
    { name: 'Bala', role: 'Senior Data Scientist', img: 'mentooors5.jpeg', desc: 'Builds predictive ML models for accurate predictions across healthcare and BFSI sectors with 8+ years of experience', skills: ['B2B Consultations', 'AWS', 'Machine learning', 'SQL', 'GenAI'] },
    { name: 'Kishore', role: 'Senior AI Engineer', img: 'mentooors6.jpg', desc: 'Builds Agentic AI solutions and automations for Supply chain and automobile industry with 8+ years of Industrial Experience', skills: ['B2B Consultations', 'Azure', 'Machine learning', 'SQL', 'GenAI'] },
  ],
  [
    { name: 'Mahesh', role: 'Senior AI Engineer', img: 'mentooors7.jpeg', desc: 'Builds scalable AI solutions for Supply chain and automobile industry with 3+ years of Industrial Experience', skills: ['Machine learning', 'SQL', 'GenAI', 'AgenticAI'] },
    { name: 'Deepak Raj', role: 'Agentic AI Engineer', img: 'mentooors8.jpeg', desc: 'Builds Agentic AI automations for Supply chain and automobile industry to reduce manual efforts and improve the process efficiency', skills: ['Machine learning', 'SQL', 'GenAI', 'AgenticAI'] },
    { name: 'Rizwan Ahmed', role: 'Bio Research Analytics Engineer', img: 'mentooors9.jpeg', desc: 'Pre-Doctoral Fellow at IIT Kharagpur who Engineers biomaterial scaffolds for regenerative medicine by integrating tissue engineering with systems pharmacology and AI-driven analytics.', skills: ['Statistical Modeling', 'Machine Learning', 'Python'] },
  ],
];

function ExpertCard({ expert }) {
  return (
    <article className="aa-expert">
      <div className="aa-expert__avatar">
        <SmartImg
          src={IMG + expert.img}
          alt={expert.name}
          fallback={<span className="aa-expert__initial">{expert.name.charAt(0)}</span>}
        />
      </div>
      <Quote className="aa-expert__quote" size={28} fill="currentColor" aria-hidden="true" />
      <h3 className="aa-expert__name">{expert.name}</h3>
      <span className="aa-expert__role">{expert.role}</span>
      <p className="aa-expert__desc">{expert.desc}</p>
      {expert.skills.length > 0 && (
        <div className="aa-expert__skills">
          <h5>Key skills</h5>
          <ul>
            {expert.skills.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

export default function ExpertPanelSection() {
  return (
    <section className="aa-experts" id="instructors">
      <div className="aa-container">
        <h2 className="aa-h2">
          Our Data <span>Experts Pannel</span>
        </h2>
        <p className="aa-sub">
          A Unified team of data experts, with hands-on experience across diverse industries
          Healthcare, Automobile, Manufacturing, Telemetry, Semiconductors, Supply Chain, BFSI and
          Talent Acquisition
        </p>

        <div className="aa-experts__rows">
          {rows.map((row, i) => (
            <div key={i} className={`aa-experts__row ${row.length === 3 ? 'is-three' : ''}`}>
              {row.map((expert) => (
                <ExpertCard key={expert.name} expert={expert} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
