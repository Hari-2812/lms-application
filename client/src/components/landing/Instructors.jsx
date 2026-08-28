import { BookOpen, Users } from 'lucide-react';
import Avatar from '../common/Avatar.jsx';
import Badge from '../common/Badge.jsx';
import Reveal from '../common/Reveal.jsx';
import SectionHeading from '../common/SectionHeading.jsx';
import { compactNumber, instructorsFrom } from '../../utils/course.js';

/**
 * Instructors are grouped out of the live catalogue, so the course and
 * student counts come straight from the API rather than being written by hand.
 */
export default function Instructors({ courses = [] }) {
  const instructors = instructorsFrom(courses);
  if (instructors.length === 0) return null;

  return (
    <section id="instructors" className="section scroll-mt-20 bg-surface-muted">
      <div className="container">
        <Reveal>
          <SectionHeading
            eyebrow="Meet the team"
            title="Top instructors"
            description="The people behind the courses in the catalogue."
            align="center"
          />
        </Reveal>

        <div
          className={`mx-auto mt-12 grid gap-5 ${
            instructors.length === 1
              ? 'max-w-sm'
              : instructors.length === 2
                ? 'max-w-3xl sm:grid-cols-2'
                : 'sm:grid-cols-2 lg:grid-cols-3'
          }`}
        >
          {instructors.map((instructor, index) => {
            const students = compactNumber(instructor.studentsCount);

            return (
              <Reveal key={instructor.name} delay={index * 0.06}>
                <article className="card flex h-full flex-col items-center p-7 text-center transition duration-300 hover:border-ink-200 hover:shadow-card-hover">
                  <Avatar name={instructor.name} src={instructor.avatar} size="xl" />
                  <h3 className="mt-4 text-base font-semibold text-ink-900">{instructor.name}</h3>
                  {instructor.title && (
                    <p className="mt-1 text-[13px] text-ink-500">{instructor.title}</p>
                  )}

                  {instructor.categories.length > 0 && (
                    <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                      {instructor.categories.map((category) => (
                        <Badge key={category} tone="primary">
                          {category}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <dl className="mt-6 flex w-full items-center justify-center gap-8 border-t border-ink-100 pt-5">
                    <div>
                      <dt className="flex items-center justify-center gap-1.5 text-[11px] text-ink-500">
                        <BookOpen className="h-3.5 w-3.5" aria-hidden="true" /> Courses
                      </dt>
                      <dd className="mt-1 text-lg font-bold text-ink-900">
                        {instructor.courseCount}
                      </dd>
                    </div>
                    {students && (
                      <div>
                        <dt className="flex items-center justify-center gap-1.5 text-[11px] text-ink-500">
                          <Users className="h-3.5 w-3.5" aria-hidden="true" /> Students
                        </dt>
                        <dd className="mt-1 text-lg font-bold text-ink-900">{students}</dd>
                      </div>
                    )}
                  </dl>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
