import { usePageMeta } from '../components/layout/DashboardLayout.jsx';
import HowItWorks from '../components/HowItWorks.jsx';

export default function HowItWorksPage() {
  usePageMeta('How It Works', 'The exact path a video takes from private storage to your screen.');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink-900">How video delivery works</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-500">
          Course videos live in a private Google Drive folder and are proxied by our own Express
          API. The browser never receives a Drive link, and the credentials never leave the server.
        </p>
      </div>

      <HowItWorks />
    </div>
  );
}
