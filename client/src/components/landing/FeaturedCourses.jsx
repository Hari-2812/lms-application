import { ArrowRight } from 'lucide-react';
import Button from '../common/Button.jsx';
import Reveal from '../common/Reveal.jsx';
import SectionHeading from '../common/SectionHeading.jsx';
import CourseGrid from '../courses/CourseGrid.jsx';

/** Live catalogue preview — the same CourseCard the dashboard uses. */
export default function FeaturedCourses({ courses = [], loading = false, limit = 6 }) {
  const featured = courses.slice(0, limit);

  return (
    <section id="courses" className="section scroll-mt-20 bg-surface-muted">
      <div className="container">
        <Reveal>
          <SectionHeading
            eyebrow="Our courses"
            title="Explore our courses"
            description="Learn from carefully designed courses created to help you build practical skills."
            action={
              <Button to="/courses" variant="secondary">
                View all courses
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            }
          />
        </Reveal>

        <Reveal delay={0.08} className="mt-10">
          {!loading && featured.length === 0 ? (
            <p className="card p-8 text-center text-sm text-ink-500">
              The course catalogue will appear here as soon as the API is reachable.
            </p>
          ) : (
            <CourseGrid courses={featured} loading={loading} skeletonCount={3} />
          )}
        </Reveal>
      </div>
    </section>
  );
}
