import { useMemo } from 'react';
import useCourses from '../hooks/useCourses.js';
import Hero from '../components/landing/Hero.jsx';
import TrustBar from '../components/landing/TrustBar.jsx';
import AboutSection from '../components/landing/AboutSection.jsx';
import FeaturedCourses from '../components/landing/FeaturedCourses.jsx';
import Categories from '../components/landing/Categories.jsx';
import Features from '../components/landing/Features.jsx';
import Testimonials from '../components/landing/Testimonials.jsx';
import Instructors from '../components/landing/Instructors.jsx';
import BlogSection from '../components/landing/BlogSection.jsx';
import FaqSection from '../components/landing/FaqSection.jsx';
import CTASection from '../components/landing/CTASection.jsx';
import { formatHours } from '../utils/course.js';

/**
 * Public landing page.
 *
 * Every number shown comes from the live catalogue; when the API is
 * unreachable the affected figures fall back to em-dashes and the
 * course-driven sections hide themselves rather than showing invented data.
 */
export default function Home() {
  const { courses, status } = useCourses();
  const loading = status === 'loading';

  const stats = useMemo(() => {
    const lessons = courses.reduce((sum, c) => sum + (c.lessonCount || 0), 0);
    const hours = courses.reduce((sum, c) => sum + (c.hours || 0), 0);

    return [
      { label: 'Courses', value: courses.length || '—' },
      { label: 'Lessons', value: lessons || '—' },
      { label: 'Hours of content', value: formatHours(hours) || '—' },
    ];
  }, [courses]);

  return (
    <>
      <Hero stats={stats} />
      <TrustBar />
      <AboutSection stats={stats.slice(0, 2)} />
      <FeaturedCourses courses={courses} loading={loading} />
      <Categories courses={courses} />
      <Features />
      <Testimonials />
      <Instructors courses={courses} />
      <BlogSection />
      <FaqSection />
      <CTASection />
    </>
  );
}
