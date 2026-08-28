import { ArrowRight } from 'lucide-react';
import Button from '../common/Button.jsx';
import Reveal from '../common/Reveal.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

/** Closing call to action. Adapts to whether the visitor is already signed in. */
export default function CTASection() {
  const { isAuthenticated } = useAuth();

  return (
    <section className="section">
      <div className="container">
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-800 via-primary-700 to-primary-600 px-6 py-16 text-center sm:px-12 lg:py-20">
            <div
              className="pointer-events-none absolute inset-0 opacity-20 bg-grid"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl"
              aria-hidden="true"
            />

            <div className="relative mx-auto max-w-2xl">
              <h2 className="text-2xl text-white sm:text-display-sm">Start learning today</h2>
              <p className="mt-4 text-[15px] leading-relaxed text-primary-100">
                Build new skills and take the next step toward your goals — your progress is saved
                from the very first lesson.
              </p>

              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <Button to={isAuthenticated ? '/dashboard' : '/register'} variant="inverse" size="lg">
                  {isAuthenticated ? 'Go to Dashboard' : 'Get Started'}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button to="/courses" variant="inverse-outline" size="lg">
                  Browse Courses
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
