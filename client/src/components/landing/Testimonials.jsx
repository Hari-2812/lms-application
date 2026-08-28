import { Quote } from 'lucide-react';
import Avatar from '../common/Avatar.jsx';
import Rating from '../common/Rating.jsx';
import Reveal from '../common/Reveal.jsx';
import SectionHeading from '../common/SectionHeading.jsx';

/**
 * Placeholder testimonials.
 *
 * Deliberately modest and specific — no "a million students" style claims.
 * Replace with real reviews once the API exposes them.
 */
const testimonials = [
  {
    name: 'A. Ramesh',
    role: 'Switching into frontend development',
    rating: 5,
    quote:
      'The progress bar remembering exactly where I stopped sounds like a small thing, but it is the reason I keep coming back instead of losing my place and giving up.',
  },
  {
    name: 'P. Nair',
    role: 'Computer science student',
    rating: 5,
    quote:
      'Lessons are short and in a sensible order rather than one three-hour video, so I can finish one properly between classes.',
  },
  {
    name: 'S. Kumar',
    role: 'Backend developer learning React',
    rating: 4,
    quote:
      'Clear curriculum, no filler, and the player just works — seeking mid-lesson is instant even on a slow connection.',
  },
];

export default function Testimonials() {
  return (
    <section id="testimonials" className="section scroll-mt-20">
      <div className="container">
        <Reveal>
          <SectionHeading
            eyebrow="Student stories"
            title="What learners say"
            description="Feedback from people working through the courses right now."
            align="center"
          />
        </Reveal>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <Reveal key={testimonial.name} delay={index * 0.06}>
              <figure className="card flex h-full flex-col p-6">
                <Quote className="h-7 w-7 text-primary-200" aria-hidden="true" />
                <blockquote className="mt-4 flex-1 text-[14px] leading-relaxed text-ink-700">
                  {testimonial.quote}
                </blockquote>

                <Rating value={testimonial.rating} className="mt-5" />

                <figcaption className="mt-4 flex items-center gap-3 border-t border-ink-100 pt-4">
                  <Avatar name={testimonial.name} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink-900">
                      {testimonial.name}
                    </span>
                    <span className="block truncate text-xs text-ink-500">{testimonial.role}</span>
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
