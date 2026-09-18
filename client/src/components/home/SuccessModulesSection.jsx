import './SuccessModulesSection.css';

const phases = [
  {
    title: 'Phase 1',
    toolsHeading: 'DA Tools',
    tools: ['Python', 'SQL', 'Power BI', 'Statistics'],
    roles: ['Data Engineer', 'Data Analyst', 'Visualization Engineer', 'Data Consultant'],
    bonus: 'SQL Developer & Python Developer',
  },
  {
    title: 'Phase 2',
    toolsHeading: 'AI Tools',
    tools: ['GenAi and ML Flow with AgenticAI', 'Data Science', 'Machine Learning', 'MLflow'],
    roles: ['GenAI Specialist', 'Data Scientist', 'ML Engineer', 'AgenticAI Specialist'],
    bonus: '1 lakh worth digital notes',
  },
];

export default function SuccessModulesSection() {
  return (
    <section className="aa-success">
      <div className="aa-container">
        <h2 className="aa-h2">
          Our Success Strategy <span>Module</span>
        </h2>
        <p className="aa-sub">
          Prepared exclusively for freshers, immediate job seekers, and career transition candidates
          from our core data scientist panel
        </p>

        <div className="success-strategy-container">
          <div className="success-strategy-diagram">
            <div className="success-phases-list">
              {phases.map((phase) => (
                <div className="success-phase-row" key={phase.title}>
                  <div className="success-phase-title">{phase.title}</div>

                  <div className="success-list-container">
                    <div className="bracket-left" />
                    <div className="success-list-content">
                      <h4 className="success-column-heading">{phase.toolsHeading}</h4>
                      <ul className="success-skills-list">
                        {phase.tools.map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="success-list-container">
                    <div className="bracket-left" />
                    <div className="success-list-content">
                      <h4 className="success-column-heading">Roles &amp; Designations</h4>
                      <ul className="success-roles-list">
                        {phase.roles.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="success-bonus-container">
                    <span className="success-plus-sign">+</span>
                    <span className="success-bonus-text">{phase.bonus}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
