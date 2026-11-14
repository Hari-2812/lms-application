import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileText,
  FolderOpen,
  Link as LinkIcon,
  ListVideo,
  Lock,
  NotebookPen,
  Presentation,
  X,
} from 'lucide-react';
import {
  getCourse,
  getCourseLessons,
  getCourseResources,
  getProgress,
  saveProgress,
  streamUrl,
  toErrorMessage,
} from '../api/client';
import Badge from '../components/common/Badge.jsx';
import Button from '../components/common/Button.jsx';
import Logo from '../components/common/Logo.jsx';
import ProgressBar from '../components/common/ProgressBar.jsx';
import Tabs from '../components/common/Tabs.jsx';
import Curriculum from '../components/courses/Curriculum.jsx';
import CourseReviews from '../components/courses/CourseReviews.jsx';
import { safeExternalUrl } from '../utils/url.js';
import VideoPlayer from '../components/VideoPlayer.jsx';
import { ErrorState, LoadingState } from '../components/States.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDuration } from '../utils/format.js';

/** Progress is pushed to the API at most this often while the video plays. */
const SAVE_INTERVAL_MS = 8000;

/** Per-lesson notes are local to the browser until a notes API exists. */
const notesKey = (lessonId) => `lms.notes.${lessonId}`;

const RESOURCE_ICON = { pdf: FileText, doc: FileText, slides: Presentation, link: LinkIcon };
const RESOURCE_LABEL = { pdf: 'PDF', doc: 'Document', slides: 'Slides', link: 'Link' };

/** Share of the video covered by the played spans, 0–100. */
function coveragePercent(watched, duration) {
  if (!duration || !Array.isArray(watched)) return 0;
  const seconds = watched.reduce((sum, [start, end]) => sum + Math.max(0, end - start), 0);
  return Math.min(100, Math.floor((seconds / duration) * 100));
}

export default function CourseLearning() {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const { student, isAdmin } = useAuth();

  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [resumeAt, setResumeAt] = useState(0);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [resources, setResources] = useState([]);
  const [resourcesError, setResourcesError] = useState('');
  const [tab, setTab] = useState('resources');
  // How much of this video has been played in this visit — shown live,
  // between the periodic saves that bring back the server's figure.
  const [livePercent, setLivePercent] = useState(0);

  const lastSavedAt = useRef(0);
  const lastSave = useRef(Promise.resolve(null));
  const tabsRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setLivePercent(0);
    lastSavedAt.current = 0;

    Promise.all([getCourse(courseId), getCourseLessons(courseId), getProgress(lessonId)])
      .then(([courseData, lessonData, progressData]) => {
        if (cancelled) return;
        setCourse(courseData);
        setLessons(lessonData);
        // Finished lessons restart from the top; unfinished ones resume.
        setResumeAt(progressData.completed ? 0 : progressData.position || 0);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(toErrorMessage(err));
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [courseId, lessonId]);

  // Study materials for the course, listed under the video.
  useEffect(() => {
    let cancelled = false;
    setResourcesError('');
    getCourseResources(courseId)
      .then((data) => !cancelled && setResources(data))
      .catch((err) => {
        if (cancelled) return;
        setResources([]);
        setResourcesError(toErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  /** The "Resources" button: switch to the materials tab and bring it into view. */
  const openResources = () => {
    setTab('resources');
    requestAnimationFrame(() => tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  // Load whatever the student wrote against this lesson previously.
  useEffect(() => {
    try {
      setNotes(localStorage.getItem(notesKey(lessonId)) || '');
    } catch {
      setNotes('');
    }
    setPanelOpen(false);
  }, [lessonId]);

  const onNotesChange = (event) => {
    setNotes(event.target.value);
    try {
      localStorage.setItem(notesKey(lessonId), event.target.value);
    } catch {
      /* private mode — notes just won't persist */
    }
  };

  /** Re-reads the lesson list — after a completion, so the next lesson unlocks. */
  const refreshLessons = useCallback(
    () =>
      getCourseLessons(courseId)
        .then((fresh) => {
          setLessons(fresh);
          return fresh;
        })
        .catch(() => null),
    [courseId]
  );

  /**
   * Throttled progress save: every 8s while playing, plus immediately on
   * pause, on end and when leaving the lesson. `watched` is the spans of the
   * video actually played; the server turns them into the lesson's percent.
   */
  const handleProgress = useCallback(
    (position, duration, force = false, watched = []) => {
      if (!duration || !Number.isFinite(duration)) return;

      // Only re-render when the whole-number percentage moves.
      const sessionPercent = coveragePercent(watched, duration);
      setLivePercent((prev) => (sessionPercent > prev ? sessionPercent : prev));

      const now = Date.now();
      if (!force && now - lastSavedAt.current < SAVE_INTERVAL_MS) return;
      lastSavedAt.current = now;

      lastSave.current = saveProgress({ lessonId, position, duration, watched })
        .then((saved) => {
          setLessons((prev) =>
            prev.map((l) =>
              l._id === lessonId
                ? {
                    ...l,
                    progress: {
                      position: saved.position,
                      percent: saved.percent,
                      watchedSeconds: saved.watchedSeconds,
                      completed: saved.completed,
                      updatedAt: saved.updatedAt,
                    },
                  }
                : l
            )
          );
          // Finishing this lesson unlocks the next — fetch the new lock states.
          if (saved.justCompleted) refreshLessons();
          return saved;
        })
        .catch(() => {
          /* progress saving is best-effort — never interrupt playback */
          return null;
        });
    },
    [lessonId, refreshLessons]
  );

  /**
   * At the end of the video, wait for the final save and move on — but only
   * to a lesson that is unlocked. Reaching the end by skipping ahead leaves
   * the lesson incomplete, so the learner stays put.
   */
  const handleEnded = async () => {
    await lastSave.current;
    const fresh = (await refreshLessons()) || lessons;
    const at = fresh.findIndex((l) => l._id === lessonId);
    const upcoming = at >= 0 ? fresh[at + 1] : null;
    if (upcoming && !upcoming.locked) navigate(`/learn/${courseId}/${upcoming._id}`);
  };

  const completedCount = useMemo(
    () => lessons.filter((l) => l.progress?.completed).length,
    [lessons]
  );

  if (status === 'loading') {
    return (
      <div className="grid min-h-screen place-items-center">
        <LoadingState label="Loading lesson…" />
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="mx-auto w-full max-w-2xl p-6">
        <ErrorState message={error} />
      </div>
    );
  }

  const index = lessons.findIndex((l) => l._id === lessonId);
  const lesson = lessons[index];

  if (!lesson) {
    return (
      <div className="mx-auto w-full max-w-2xl p-6">
        <ErrorState message="This lesson is not part of the course." />
      </div>
    );
  }

  const previous = index > 0 ? lessons[index - 1] : null;
  const next = index < lessons.length - 1 ? lessons[index + 1] : null;
  const isCompleted = Boolean(lesson.progress?.completed);
  const coursePercent = lessons.length ? Math.round((completedCount / lessons.length) * 100) : 0;
  // This video's progress: the saved figure, or what has been played since
  // the last save if that is further along.
  const lessonPercent = isCompleted ? 100 : Math.max(lesson.progress?.percent || 0, livePercent);
  // The lesson the learner is up to — where a locked lesson sends them.
  const currentLesson = lessons.find((l) => !l.locked && !l.progress?.completed) || lessons.find((l) => !l.locked);
  // The curriculum shows the live percentage for the video that is playing.
  const listedLessons = lessons.map((l) =>
    l._id === lessonId && !isCompleted ? { ...l, progress: { ...l.progress, percent: lessonPercent } } : l
  );

  const goTo = (target) => navigate(`/learn/${courseId}/${target._id}`);

  const curriculumPanel = (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-ink-800 px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <ListVideo className="h-4 w-4 text-ink-400" aria-hidden="true" />
          Course content
        </h2>
        <span className="text-xs tabular-nums text-ink-400">
          {completedCount}/{lessons.length}
        </span>
        <button
          type="button"
          onClick={() => setPanelOpen(false)}
          aria-label="Close course content"
          className="-mr-2 rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-800 hover:text-white lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-ink-800 px-5 py-4">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-ink-400">Course progress</span>
          <span className="font-semibold tabular-nums text-white">{coursePercent}%</span>
        </div>
        <ProgressBar
          value={coursePercent}
          tone={coursePercent >= 100 ? 'success' : 'primary'}
          className="bg-ink-800"
          label={`${course.title} progress`}
        />
      </div>

      {/* The list re-uses the shared Curriculum in its dark theme. */}
      <div className="scrollbar-slim flex-1 overflow-y-auto">
        <Curriculum
          lessons={listedLessons}
          courseId={courseId}
          activeLessonId={lessonId}
          isLocked={(l) => Boolean(l.locked)}
          theme="dark"
        />
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col">
      {/* --- Learning top bar ----------------------------------------- */}
      <header className="sticky top-0 z-30 border-b border-ink-800 bg-ink-900/95 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
          <Link
            to={`/my-courses/${courseId}`}
            className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-ink-300 transition hover:bg-ink-800 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Back to course</span>
          </Link>

          <div className="mx-2 hidden h-5 w-px bg-ink-800 sm:block" />

          <Logo to="/dashboard" tone="light" compact className="shrink-0" />

          <div className="mx-2 hidden h-5 w-px bg-ink-800 sm:block" />

          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{course.title}</p>

          <span className="hidden items-center gap-2 text-xs text-ink-400 sm:flex">
            <span className="tabular-nums">{coursePercent}% complete</span>
          </span>

          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-ink-800 px-3 py-2 text-[13px] font-semibold text-white transition hover:bg-ink-700 lg:hidden"
          >
            <ListVideo className="h-4 w-4" aria-hidden="true" />
            Lessons
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        {/* --- Player + lesson detail --------------------------------- */}
        <div className="min-w-0 flex-1">
          <div className="bg-black">
            <div className="mx-auto max-w-5xl">
              {lesson.locked ? (
                // The API refuses this lesson's stream too; this explains why.
                <div className="grid aspect-video w-full place-items-center bg-ink-900 px-6 text-center">
                  <div className="max-w-md">
                    <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-ink-800">
                      <Lock className="h-6 w-6 text-ink-300" aria-hidden="true" />
                    </span>
                    <p className="mt-4 text-base font-semibold text-white">This lesson is locked</p>
                    <p className="mt-2 text-sm leading-relaxed text-ink-300">
                      Lessons unlock one at a time. Finish
                      {previous ? <> &ldquo;{previous.title}&rdquo;</> : ' the previous lesson'} to open this one.
                    </p>
                    {currentLesson && currentLesson._id !== lesson._id && (
                      <Button className="mt-5" onClick={() => goTo(currentLesson)}>
                        Go to lesson {currentLesson.order}
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <VideoPlayer
                  key={lesson._id}
                  src={streamUrl(lesson._id)}
                  startAt={resumeAt}
                  watermark={{ name: student?.name, label: 'AnalyticsAvenue EduTech' }}
                  onProgress={handleProgress}
                  onEnded={handleEnded}
                  showDetails={isAdmin}
                />
              )}
            </div>
          </div>

          <div className="bg-surface-muted">
            <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
              <section className="card p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="primary">
                        Lesson {lesson.order} of {lessons.length}
                      </Badge>
                      <span className="text-xs text-ink-500">
                        {formatDuration(lesson.duration)}
                      </span>
                    </div>
                    <h1 className="mt-3 text-xl font-bold text-ink-900">{lesson.title}</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
                      {lesson.description}
                    </p>
                  </div>

                  {isCompleted && (
                    <Badge tone="success" icon={CheckCircle2} className="px-2.5 py-1.5">
                      Completed
                    </Badge>
                  )}
                </div>

                {!lesson.locked && (
                  <div className="mt-5">
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-medium text-ink-600">Video progress</span>
                      <span className="font-semibold tabular-nums text-ink-900">{lessonPercent}% watched</span>
                    </div>
                    <ProgressBar
                      value={lessonPercent}
                      tone={isCompleted ? 'success' : 'primary'}
                      label={`${lesson.title} watched`}
                    />
                    {!isCompleted && next?.locked && (
                      <p className="mt-2 text-xs text-ink-500">
                        Finish watching this video to unlock the next lesson — parts you skip do not count.
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-6 flex items-center justify-between gap-3 border-t border-ink-100 pt-5">
                  <Button
                    variant="secondary"
                    onClick={() => previous && !previous.locked && goTo(previous)}
                    disabled={!previous || previous.locked}
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Previous</span>
                  </Button>

                  <Button variant="soft" onClick={openResources} aria-label={`Resources (${resources.length})`}>
                    <FolderOpen className="h-4 w-4" aria-hidden="true" />
                    Resources
                    <span className="rounded-md bg-white px-1.5 py-0.5 text-[11px] tabular-nums text-primary-700">
                      {resources.length}
                    </span>
                  </Button>

                  <Button
                    onClick={() => next && !next.locked && goTo(next)}
                    disabled={!next || next.locked}
                    title={next?.locked ? 'Complete this lesson to unlock the next one' : undefined}
                  >
                    {next?.locked && <Lock className="h-4 w-4" aria-hidden="true" />}
                    <span className="hidden sm:inline">Next lesson</span>
                    <span className="sm:hidden">Next</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </section>

              <section ref={tabsRef} className="scroll-mt-20">
                <Tabs
                  value={tab}
                  onChange={setTab}
                  tabs={[
                    { value: 'resources', label: 'Resources', count: resources.length },
                    { value: 'reviews', label: 'Reviews' },
                    { value: 'notes', label: 'Notes' },
                  ]}
                />

                {tab === 'resources' && (
                  <div className="card mt-4 p-5">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-ink-400" aria-hidden="true" />
                      <h2 className="text-sm font-semibold text-ink-900">Learning materials for this course</h2>
                    </div>
                    {resourcesError ? (
                      <p className="mt-3 text-[13px] text-red-600">{resourcesError}</p>
                    ) : resources.length === 0 ? (
                      <p className="mt-3 text-[13px] leading-relaxed text-ink-600">
                        No study materials have been added to this course yet. They will appear here, and
                        under Resources in the sidebar, as soon as they are.
                      </p>
                    ) : (
                      <ul className="mt-4 space-y-2">
                        {resources.map((resource) => {
                          const Icon = RESOURCE_ICON[resource.type] || FileText;
                          const href = safeExternalUrl(resource.url);
                          return (
                            <li key={resource.id}>
                              <a
                                href={href || undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-disabled={!href}
                                className="group flex items-center gap-3 rounded-xl border border-ink-100 bg-white p-3.5 transition hover:border-primary-200 hover:shadow-sm"
                              >
                                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary-600">
                                  <Icon className="h-5 w-5" aria-hidden="true" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-semibold text-ink-900">{resource.title}</span>
                                  <span className="block truncate text-xs text-ink-500">
                                    {RESOURCE_LABEL[resource.type] || 'File'}
                                    {resource.description ? ` · ${resource.description}` : ''}
                                  </span>
                                </span>
                                <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-primary-700 group-hover:text-primary-800">
                                  Open <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                                </span>
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}

                {tab === 'reviews' && <CourseReviews courseId={courseId} className="mt-4" />}

                {tab === 'notes' && (
                  <div className="card mt-4 p-5">
                    <div className="flex items-center gap-2">
                      <NotebookPen className="h-4 w-4 text-ink-400" aria-hidden="true" />
                      <h2 className="text-sm font-semibold text-ink-900">Your notes</h2>
                    </div>
                    <label htmlFor="lesson-notes" className="sr-only">
                      Notes for this lesson
                    </label>
                    <textarea
                      id="lesson-notes"
                      value={notes}
                      onChange={onNotesChange}
                      rows={5}
                      placeholder="Jot down anything you want to remember from this lesson…"
                      className="field-input mt-3 resize-y leading-relaxed"
                    />
                    <p className="mt-2 text-[11px] text-ink-500">Saved in this browser.</p>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>

        {/* --- Curriculum panel: docked on desktop, drawer on mobile --- */}
        <aside className="hidden w-80 shrink-0 border-l border-ink-800 bg-ink-900 lg:flex xl:w-96">
          <div className="sticky top-14 flex h-[calc(100vh-3.5rem)] w-full flex-col">
            {curriculumPanel}
          </div>
        </aside>

        <div
          className={`fixed inset-0 z-40 overflow-hidden lg:hidden ${panelOpen ? '' : 'pointer-events-none'}`}
          aria-hidden={!panelOpen}
        >
          <div
            onClick={() => setPanelOpen(false)}
            className={`absolute inset-0 bg-ink-950/60 transition-opacity duration-200 ${
              panelOpen ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <div
            className={`absolute inset-y-0 right-0 flex w-80 max-w-[85vw] flex-col bg-ink-900 shadow-pop transition-transform duration-200 ease-out ${
              panelOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            {curriculumPanel}
          </div>
        </div>
      </div>

    </div>
  );
}
