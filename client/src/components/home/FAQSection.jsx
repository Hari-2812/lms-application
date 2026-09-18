import { useState } from 'react';
import { Plus } from 'lucide-react';

const faqs = [
  {
    q: 'Who is this program designed for?',
    a: 'Designed for freshers, final-year students, working professionals, career switchers, and non-IT candidates looking to build careers in Data Analytics, Data Engineering, Machine Learning, and Generative AI.',
  },
  {
    q: 'Do I need a coding background to join this program?',
    a: 'No. The program starts from fundamentals and gradually covers Python, SQL, Power BI, Machine Learning, Cloud, and Generative AI.',
  },
  {
    q: 'What technologies and tools will I learn?',
    a: 'Python, SQL, Power BI, Machine Learning, GPT, Claude, LangChain, LlamaIndex, RAG, AI Agents, AWS, GCP, Databricks, Snowflake, Git, and GitHub.',
  },
  {
    q: 'What is the training format?',
    a: 'Live instructor-led sessions, recorded sessions, assignments, projects, mentorship, and career guidance.',
  },
  {
    q: 'Will I work on real-world projects?',
    a: 'Yes. Projects span Marketing Analytics, Healthcare, Finance, Supply Chain, Automobile, Telemetry, Bioinformatics, and Generative AI, where you will recreate the projects our mentors built in their sectors.',
  },
  {
    q: 'How does placement assistance work?',
    a: 'Through a 3-mode placement strategy: Organic Job Opportunities, Project Acquisition, and Referral Network, plus resume and interview support.',
  },
  {
    q: 'How long does it take to become job-ready?',
    a: 'Approximately 90–120 days, depending on commitment and completion of projects and certifications.',
  },
  {
    q: 'What makes Analytics Avenue different?',
    a: 'Industry mentors, real-world projects, GenAI-integrated curriculum, certifications, placement support, and practical learning. Recreate real industry projects and work under senior data scientists — our mentors are working professionals in different MNCs with 8+ years of experience.',
  },
  {
    q: 'Is there an internship in the program?',
    a: "Yes — 100 candidates per year are selected for an expert internship inside Analytics Avenue's AI consulting operations. Interns work on real client deliverables, build business proposals, and gain end-to-end analytics exposure. Competitive: 100 spots from 5,000+ enrollments.",
  },
  {
    q: 'Who is eligible to join this program?',
    a: 'Anyone with a genuine intent to build a career in data — freshers, working professionals, career switchers, non-IT graduates, MBA holders, engineers, science graduates. The program has trained people from all these backgrounds. No prior coding experience required for Phase 1.',
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <section className="aa-faq" id="faq">
      <div className="aa-container">
        <h2 className="aa-h2">
          Frequently Asked <span>Questions</span>
        </h2>

        <div className="aa-faq__list">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={faq.q} className={`aa-faq__item ${isOpen ? 'is-open' : ''}`}>
                <h3 style={{ margin: 0 }}>
                  <button
                    type="button"
                    className="aa-faq__btn"
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${i}`}
                    id={`faq-btn-${i}`}
                  >
                    {faq.q}
                    <span className="aa-faq__icon" aria-hidden="true">
                      <Plus size={16} strokeWidth={2.5} />
                    </span>
                  </button>
                </h3>
                <div className="aa-faq__panel" id={`faq-panel-${i}`} role="region" aria-labelledby={`faq-btn-${i}`}>
                  <div>
                    <p>{faq.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
