import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Globe,
  Heart,
  Hourglass,
  Infinity as InfinityIcon,
  Lock,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { getCourse, getCourseLessons, toErrorMessage } from '../api/client';
import { useIsDashboard, usePageMeta } from '../components/layout/DashboardLayout.jsx';
import Avatar from '../components/common/Avatar.jsx';
import Badge from '../components/common/Badge.jsx';
import Button from '../components/common/Button.jsx';
import Rating from '../components/common/Rating.jsx';
import RichText from '../components/common/RichText.jsx';
import Tabs from '../components/common/Tabs.jsx';
import CourseProgress from '../components/courses/CourseProgress.jsx';
import CourseThumbnail from '../components/courses/CourseThumbnail.jsx';
import Curriculum from '../components/courses/Curriculum.jsx';
import IntroVideo from '../components/courses/IntroVideo.jsx';
import { ErrorState, LoadingState } from '../components/States.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import useWishlist from '../hooks/useWishlist.js';
import { compactNumber, formatHours, formatPrice } from '../utils/course.js';
import { formatDuration } from '../utils/format.js';
import { hasRichText } from '../utils/sanitize.js';

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'curriculum', label: 'Curriculum' },
  { value: 'instructor', label: 'Instructor' },
  { value: 'reviews', label: 'Reviews' },
];

export default function CourseDetails() {
  const { courseId } = useParams();
  const { isAuthenticated } = useAuth();
  const { has: isSaved, toggle: toggleWishlist } = useWishlist();
  const inDashboard = useIsDashboard();

  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    getCourse(courseId)
      .then((courseData) => {
        if (cancelled) return null;
        setCourse(courseData);

        // Locked courses have no lessons the student can see yet — skip the
        // (403-ing) lessons request rather than surfacing it as an error.
        if (!courseData.hasAccess) {
          setLessons([]);
          setTab('overview');
          setStatus('ready');
          return null;
        }

        return getCourseLessons(courseId).then((lessonData) => {
          if (cancelled) return;
          setLessons(lessonData);
          // A course with no outcomes or requirements yet would show an
          // almost empty Overview, so open on the curriculum instead.
          const hasOverview =
            courseData.outcomes?.length > 0 || courseData.requirements?.length > 0;
          setTab(hasOverview ? 'overview' : 'curriculum');
          setStatus('ready');
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(toErrorMessage(err));
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  usePageMeta(course?.title, course ? `${course.lessonCount} lessons · ${course.level}` : undefined);

  const totalSeconds = useMemo(
    () => lessons.reduce((sum, lesson) => sum + (lesson.duration || 0), 0),
    [lessons]
  );

  if (status === 'loading') return <LoadingState label="Loading course…" />;
  if (status === 'error') return <ErrorState message={error} />;

  const Title = inDashboard ? 'h2' : 'h1';
  const nextLesson = lessons.find((l) => !l.progress?.completed) || lessons[0];
  const started = course.progress > 0;
  const complete = course.progress >= 100;
  const saved = isSaved(course._id);
  const locked = isAuthenticated && course.hasAccess === false;

  // A locked course the student has already paid for is waiting on the admin
  // to confirm the payment, which is a very different message from "you
  // need to enrol".
  const awaitingPayment = locked && course.enrollmentStatus === 'pending';

  const facts = [
    { icon: BookOpen, label: `${course.lessonCount} lessons` },
    { icon: Clock, label: formatHours(course.hours) || formatDuration(totalSeconds) },
    { icon: BarChart3, label: course.level },
    { icon: Globe, label: course.language || 'Tamil' },
    { icon: InfinityIcon, label: 'Lifetime access' },
    course.certificateIncluded !== false
      ? { icon: Award, label: 'Certificate of completion' }
      : null,
  ].filter((fact) => fact?.label);

  /**
   * What the package includes. Falls back to facts derived from the course
   * record when the admin has not filled in a feature list, so the panel is
   * never empty.
   */
  const features =
    course.features?.length > 0
      ? course.features
      : [
          `${course.lessonCount} on-demand video ${course.lessonCount === 1 ? 'lesson' : 'lessons'}`,
          'Lifetime access on any device',
          'Downloadable study material',
          ...(course.certificateIncluded !== false ? ['Certificate of completion'] : []),
        ];

  const discount =
    course.originalPrice > course.price
      ? Math.round(((course.originalPrice - course.price) / course.originalPrice) * 100)
      : 0;

  /* The primary action changes with the student's relationship to the course. */
  const primaryAction = !isAuthenticated
    ? // Signed-out visitors register first, then come back to this course.
      { to: `/register?next=${encodeURIComponent(`/courses/${course._id}/enrol`)}`, label: 'Enrol Now' }
    : awaitingPayment
      ? null
      : locked
        ? {
            to: `/courses/${course._id}/enrol`,
            label: course.price > 0 ? 'Proceed to Payment' : 'Enrol for Free',
          }
        : nextLesson
          ? {
              to: `/learn/${course._id}/${nextLesson._id}`,
              label: complete ? 'Review Course' : started ? 'Continue Learning' : 'Start Course',
            }
          : { to: '/my-courses', label: 'Back to My Courses' };

  return (
    <div className="space-y-6">
      {/* --- Hero ------------------------------------------------------ */}
      <section className="card overflow-hidden">
        <div className="relative bg-gradient-to-br from-ink-900 via-ink-900 to-primary-900 px-6 py-8 sm:px-8 sm:py-10">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-10" aria-hidden="true" />

          <div className="relative flex flex-wrap items-center gap-2">
            {course.category && <Badge tone="overlay">{course.category}</Badge>}
            <Badge tone="overlay">{course.level}</Badge>
            {course.hasDriveVideos && (
              <Badge tone="overlay" icon={ShieldCheck}>
                Secure video
              </Badge>
            )}
          </div>

          {/* The dashboard header already renders this page's <h1>. */}
          <Title className="relative mt-4 max-w-3xl text-2xl leading-tight text-white sm:text-[2rem]">
            {course.title}
          </Title>
          <p className="relative mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-300">
            {course.summary || course.description}
          </p>

          <div className="relative mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px] text-ink-300">
            {course.rating ? (
              <span className="rounded-lg bg-white/10 px-2.5 py-1.5">
                <Rating value={course.rating} count={course.ratingCount} className="[&_span]:text-white" />
              </span>
            ) : null}
            {compactNumber(course.studentsCount) && (
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" aria-hidden="true" />
                {compactNumber(course.studentsCount)} students
              </span>
            )}
            <span className="inline-flex items-center gap-2">
              <Avatar name={course.instructor} size="xs" />
              Created by <strong className="font-semibold text-white">{course.instructor}</strong>
            </span>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        {/* --- Main column -------------------------------------------- */}
        <div className="min-w-0 space-y-6">
          <Tabs tabs={TABS} value={tab} onChange={setTab} />

          {tab === 'overview' && (
            <div className="space-y-6">
              {course.introVideoUrl && (
                <section className="card overflow-hidden p-1.5">
                  <IntroVideo course={course} />
                </section>
              )}

              <section className="card p-6">
                <h2 className="text-base font-semibold text-ink-900">About this course</h2>
                {/* The admin's formatted copy wins when there is any; the
                    plain description is the fallback for courses that
                    predate the rich text editor. */}
                {hasRichText(course.descriptionHtml) ? (
                  <RichText html={course.descriptionHtml} className="mt-3" />
                ) : (
                  <p className="mt-3 text-sm leading-relaxed text-ink-600">{course.description}</p>
                )}
              </section>

              <section className="card p-6">
                <h2 className="text-base font-semibold text-ink-900">What&apos;s included</h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {features.map((feature) => (
                    <li key={feature} className="flex gap-2.5 text-sm leading-relaxed text-ink-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </section>

              {course.outcomes?.length > 0 && (
                <section className="card p-6">
                  <h2 className="text-base font-semibold text-ink-900">What you&apos;ll learn</h2>
                  <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                    {course.outcomes.map((outcome) => (
                      <li key={outcome} className="flex gap-2.5 text-sm leading-relaxed text-ink-700">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                        {outcome}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {course.requirements?.length > 0 && (
                <section className="card p-6">
                  <h2 className="text-base font-semibold text-ink-900">Requirements</h2>
                  <ul className="mt-4 space-y-2.5">
                    {course.requirements.map((requirement) => (
                      <li key={requirement} className="flex gap-2.5 text-sm text-ink-700">
                        <span
                          className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-300"
                          aria-hidden="true"
                        />
                        {requirement}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}

          {tab === 'curriculum' && (
            <section className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
                <h2 className="text-sm font-semibold text-ink-900">Course content</h2>
                {!locked && (
                  <p className="text-xs text-ink-500">
                    {lessons.length} lessons · {formatDuration(totalSeconds)}
                  </p>
                )}
              </div>
              {locked ? (
                <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                  <Lock className="h-8 w-8 text-ink-300" aria-hidden="true" />
                  {awaitingPayment ? (
                    <p className="max-w-sm text-sm text-ink-600">
                      The full lesson list unlocks once your payment is confirmed.
                    </p>
                  ) : (
                    <>
                      <p className="max-w-sm text-sm text-ink-600">
                        Enrol in this course to unlock all {course.lessonCount} lessons.
                      </p>
                      <Button to={`/courses/${course._id}/enrol`} size="sm">
                        {course.price > 0 ? 'Proceed to Payment' : 'Enrol for Free'}
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <Curriculum
                  lessons={lessons}
                  courseId={course._id}
                  linkTo={(cid, lid) => (isAuthenticated ? `/learn/${cid}/${lid}` : '/login')}
                />
              )}
            </section>
          )}

          {tab === 'instructor' && (
            <section className="card p-6">
              <div className="flex items-start gap-4">
                <Avatar name={course.instructor} size="lg" />
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-ink-900">{course.instructor}</h2>
                  {course.instructorTitle && (
                    <p className="mt-0.5 text-sm text-ink-500">{course.instructorTitle}</p>
                  )}
                  <p className="mt-4 text-sm leading-relaxed text-ink-600">
                    Teaches {course.category || course.level} on AnalyticsAvenue EduTech, with
                    lessons drawn from day-to-day production work rather than documentation
                    summaries.
                  </p>
                </div>
              </div>
            </section>
          )}

          {tab === 'reviews' && (
            <section className="card p-6">
              <h2 className="text-base font-semibold text-ink-900">Student reviews</h2>
              {course.rating ? (
                <div className="mt-4 flex items-baseline gap-4">
                  <p className="text-4xl font-bold text-ink-900">{course.rating.toFixed(1)}</p>
                  <div>
                    <Rating value={course.rating} size="md" />
                    <p className="mt-1 text-[13px] text-ink-500">
                      Based on {course.ratingCount} student ratings
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-ink-600">
                  This course has no ratings yet — be the first to leave one once you finish.
                </p>
              )}
              <p className="mt-5 rounded-lg bg-surface-muted p-3.5 text-[13px] leading-relaxed text-ink-600">
                Individual written reviews will appear here once the reviews API is available.
              </p>
            </section>
          )}
        </div>

        {/* --- Enrolment / progress panel ------------------------------ */}
        <aside className="space-y-4 lg:sticky lg:top-20">
          <section className="card overflow-hidden">
            <div className="relative aspect-[16/9] bg-ink-100">
              <CourseThumbnail course={course} />
            </div>

            <div className="p-5">
              {awaitingPayment ? (
                <div className="mb-5 flex items-start gap-2.5 rounded-lg bg-amber-50 p-3 text-[13px] font-medium text-amber-800">
                  <Hourglass className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    Payment received — we&apos;re confirming it now. The course unlocks as soon as
                    that is done.
                  </span>
                </div>
              ) : locked ? (
                /* Not enrolled yet: the panel becomes the price and the
                   route into checkout. */
                <div className="mb-5">
                  <div className="flex flex-wrap items-baseline gap-2.5">
                    <p className="text-2xl font-bold text-ink-900">{formatPrice(course.price)}</p>
                    {discount > 0 && (
                      <>
                        <p className="text-base text-ink-400 line-through">
                          {formatPrice(course.originalPrice)}
                        </p>
                        <Badge tone="success">{discount}% off</Badge>
                      </>
                    )}
                  </div>
                  <p className="mt-1.5 text-[13px] text-ink-500">
                    One-time payment · lifetime access
                  </p>
                </div>
              ) : isAuthenticated ? (
                <CourseProgress course={course} className="mb-5" />
              ) : (
                <div className="mb-5">
                  <div className="flex flex-wrap items-baseline gap-2.5">
                    <p className="text-2xl font-bold text-ink-900">{formatPrice(course.price)}</p>
                    {discount > 0 && (
                      <>
                        <p className="text-base text-ink-400 line-through">
                          {formatPrice(course.originalPrice)}
                        </p>
                        <Badge tone="success">{discount}% off</Badge>
                      </>
                    )}
                  </div>
                  <p className="mt-1.5 text-[13px] text-ink-500">
                    One-time payment · lifetime access
                  </p>
                </div>
              )}

              {primaryAction ? (
                <Button to={primaryAction.to} size="lg" fullWidth>
                  {primaryAction.label}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : (
                <Button size="lg" fullWidth disabled>
                  <Hourglass className="h-4 w-4" aria-hidden="true" />
                  Awaiting Confirmation
                </Button>
              )}

              {/* The package contents, repeated here so the figure and what
                  it buys sit together at the point of decision. */}
              {locked && !awaitingPayment && (
                <ul className="mt-5 space-y-2 border-t border-ink-100 pt-5">
                  {features.slice(0, 5).map((feature) => (
                    <li key={feature} className="flex gap-2 text-[13px] leading-relaxed text-ink-700">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
              )}

              <button
                type="button"
                onClick={() => toggleWishlist(course._id)}
                aria-pressed={saved}
                className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg
                           border border-ink-200 text-sm font-semibold text-ink-700 transition
                           hover:bg-ink-50 hover:text-ink-900"
              >
                <Heart className={`h-4 w-4 ${saved ? 'fill-red-500 text-red-500' : ''}`} aria-hidden="true" />
                {saved ? 'Saved to wishlist' : 'Save for later'}
              </button>

              <dl className="mt-6 space-y-3 border-t border-ink-100 pt-5">
                {facts.map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2.5 text-[13px] text-ink-600">
                    <Icon className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                    <dt className="sr-only">Course detail</dt>
                    <dd>{label}</dd>
                  </div>
                ))}
              </dl>

              {complete && (
                <Link
                  to="/certificates"
                  className="mt-5 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-[13px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Course complete — view certificate
                </Link>
              )}
            </div>
          </section>

          <section className="card p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-ink-900">Secure video delivery</h2>
            </div>
            <p className="mt-2.5 text-[13px] leading-relaxed text-ink-600">
              Lessons stream from private storage through our own API. No shareable video link ever
              reaches the browser.
            </p>
            <Link
              to="/how-it-works"
              className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary-700 hover:text-primary-800"
            >
              See how it works
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
