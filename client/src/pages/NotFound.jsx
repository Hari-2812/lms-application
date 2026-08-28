import { Compass, Home } from 'lucide-react';
import Button from '../components/common/Button.jsx';

export default function NotFound() {
  return (
    <section className="container flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="text-[5rem] font-bold leading-none tracking-tight text-primary-100">404</p>
      <h1 className="mt-4 text-2xl sm:text-display-sm">This page does not exist</h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink-600">
        The link may be out of date, or the page may have moved. Try the catalogue instead.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button to="/">
          <Home className="h-4 w-4" aria-hidden="true" />
          Back to home
        </Button>
        <Button to="/courses" variant="secondary">
          <Compass className="h-4 w-4" aria-hidden="true" />
          Browse courses
        </Button>
      </div>
    </section>
  );
}
