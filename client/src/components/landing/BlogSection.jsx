import { ArrowRight, CalendarDays, Clock } from 'lucide-react';
import Badge from '../common/Badge.jsx';
import Button from '../common/Button.jsx';
import Reveal from '../common/Reveal.jsx';
import SectionHeading from '../common/SectionHeading.jsx';
import { ACCENTS } from '../../utils/course.js';
import { resources } from '../../content/resources.js';

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Resources band.
 *
 * The API has no posts endpoint yet, so the articles come from
 * content/resources.js — see that file for how to wire this to a real one.
 */
export default function BlogSection({ posts = resources }) {
  if (posts.length === 0) return null;

  return (
    <section id="resources" className="section scroll-mt-20">
      <div className="container">
        <Reveal>
          <SectionHeading
            eyebrow="Resources"
            title="Latest resources"
            description="Short reads on learning well and building the habits that make courses stick."
            action={
              <Button variant="secondary" to="/courses">
                Browse courses
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            }
          />
        </Reveal>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.slice(0, 3).map((post, index) => {
            const accent = ACCENTS[post.accent] || ACCENTS.sky;

            return (
              <Reveal key={post.id} delay={index * 0.06}>
                <article className="card-interactive group flex h-full flex-col overflow-hidden">
                  <div
                    className="relative aspect-[16/9] shrink-0 overflow-hidden"
                    style={{ backgroundImage: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
                    aria-hidden="true"
                  >
                    <svg
                      className="absolute inset-0 h-full w-full opacity-20"
                      viewBox="0 0 400 220"
                      preserveAspectRatio="xMidYMid slice"
                    >
                      <circle cx="330" cy="30" r="90" fill="white" opacity="0.35" />
                      <circle cx="60" cy="200" r="60" fill="white" opacity="0.25" />
                    </svg>
                    <span className="absolute left-3 top-3">
                      <Badge tone="overlay">{post.category}</Badge>
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="text-[15px] font-semibold leading-snug text-ink-900 transition group-hover:text-primary-700">
                      {post.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-ink-600">
                      {post.excerpt}
                    </p>

                    <div className="mt-auto flex items-center justify-between gap-3 border-t border-ink-100 pt-4">
                      <span className="flex items-center gap-3 text-xs text-ink-500">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                          <time dateTime={post.date}>{formatDate(post.date)}</time>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                          {post.readMinutes} min
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary-700">
                        Read
                        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden="true" />
                      </span>
                    </div>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
