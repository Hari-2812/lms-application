import HeroSection from '../components/home/HeroSection.jsx';
import WhyAnalyticsSection from '../components/home/WhyAnalyticsSection.jsx';
import MasterAISection from '../components/home/MasterAISection.jsx';
import ExpertPanelSection from '../components/home/ExpertPanelSection.jsx';
import SuccessModulesSection from '../components/home/SuccessModulesSection.jsx';
import LiveBatchesSection from '../components/home/LiveBatchesSection.jsx';
import TestimonialsSection from '../components/home/TestimonialsSection.jsx';
import WorkingCompaniesSection from '../components/home/WorkingCompaniesSection.jsx';
import POCsSection from '../components/home/POCsSection.jsx';
import PlacementSection from '../components/home/PlacementSection.jsx';
import HonoursAndRecognitions from '../components/home/HonoursAndRecognitions.jsx';
import OutcomesSection from '../components/home/OutcomesSection.jsx';
import FAQSection from '../components/home/FAQSection.jsx';
import '../components/home/home.css';

/** Public landing page — Analytics Avenue design. */
export default function Home() {
  return (
    <div className="aa-home">
      <HeroSection />
      <WhyAnalyticsSection />
      <MasterAISection />
      <ExpertPanelSection />
      <SuccessModulesSection />
      <LiveBatchesSection />
      <TestimonialsSection />
      <WorkingCompaniesSection />
      <POCsSection />
      <PlacementSection />
      <HonoursAndRecognitions />
      <OutcomesSection />
      <FAQSection />
    </div>
  );
}
