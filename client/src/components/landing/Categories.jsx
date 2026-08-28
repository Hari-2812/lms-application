import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Reveal from '../common/Reveal.jsx';
import SectionHeading from '../common/SectionHeading.jsx';
import { categoriesFrom } from '../../utils/course.js';

/**
 * Categories are derived from the live catalogue, so both the names and the
 * course counts are real. The section hides itself when nothing is loaded.
 */
export default function Categories({ courses = [] }) {
  const categories = categoriesFrom(courses);
  if (categories.length === 0) return null;

  return (
    <section id="categories" className="section scroll-mt-20">
      <div className="container">
        <Reveal>
          <SectionHeading
            eyebrow="Browse by topic"
            title="Find the right category"
            description="Every course sits in a clear topic, so you can go straight to the skill you want next."
            align="center"
          />
        </Reveal>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category, index) => (
            <motion.li
              key={category.name}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.4, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link
                to={`/courses?category=${encodeURIComponent(category.name)}`}
                className="card group flex items-center gap-4 p-5 transition duration-300 ease-out
                           hover:-translate-y-1 hover:border-primary-200 hover:shadow-card-hover"
              >
                <span
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-600
                             transition duration-300 group-hover:scale-105 group-hover:bg-primary-600 group-hover:text-white"
                >
                  <category.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-ink-900 transition group-hover:text-primary-700">
                    {category.name}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-ink-500">
                    {category.count} {category.count === 1 ? 'course' : 'courses'}
                  </span>
                </span>
              </Link>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
