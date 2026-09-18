import { Clock, Cpu, DollarSign, Heart, RefreshCw, ShieldAlert, Sun, Target, TrendingUp } from 'lucide-react';
import './OutcomesSection.css';

const outcomes = [
  { metric: '60–65%', icon: Heart, title: 'Improvement in customer retention', desc: 'Seen with churn prediction, cohort analysis, and behavioral segmentation in retail, BFSI, and SaaS.' },
  { metric: '95–100%', icon: Sun, title: 'Faster delivery of business insights', desc: 'Achieved through automated pipelines, BI self-service, and reduced manual reporting cycles.' },
  { metric: '85–95%', icon: TrendingUp, title: 'Improvement in sales forecasting accuracy', desc: 'Typical for time-series models, demand forecasting, and scenario-based planning.' },
  { metric: '90–95%', icon: Target, title: 'Higher accuracy in customer targeting', desc: 'Driven by ML-based segmentation, propensity models, and campaign analytics.' },
  { metric: '80–90%', icon: ShieldAlert, title: 'Reduction in operational and financial risk exposure', desc: 'Observed with anomaly detection, rule-based + predictive risk analytics.' },
  { metric: '85–90%', icon: DollarSign, title: 'Increase in revenue realization', desc: 'From pricing optimization, funnel analytics, and performance-driven decisioning.' },
  { metric: '95–100%', icon: Clock, title: 'Reduction in reporting turnaround time', desc: 'Enabled through dashboard automation, reusable semantic models, and scheduled data refresh workflows.' },
  { metric: '85–95%', icon: Cpu, title: 'Improvement in process automation coverage', desc: 'Achieved by integrating AI agents, workflow orchestration, and trigger-based operations across teams.' },
  { metric: '90–100%', icon: RefreshCw, title: 'Reduction in manual rework and duplicate efforts', desc: 'Driven by standardized pipelines, data quality checks, and centralized KPI definitions.' },
];

export default function OutcomesSection() {
  return (
    <section className="outcomes-section">
      <div className="aa-container">
        <div className="outcomes-header">
          <h2 className="aa-h2">
            Outcomes <span>Achieved</span>
          </h2>
        </div>
        <div className="outcomes-grid">
          {outcomes.map(({ metric, icon: Icon, title, desc }) => (
            <div key={title} className="outcomes-card">
              <div className="outcomes-card-header">
                <div className="outcomes-icon-wrapper">
                  <Icon size={20} />
                </div>
                <span className="outcomes-metric">{metric}</span>
              </div>
              <h3 className="outcomes-card-title">{title}</h3>
              <p className="outcomes-card-desc">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
