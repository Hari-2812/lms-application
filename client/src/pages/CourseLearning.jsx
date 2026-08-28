import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  ListVideo,
  NotebookPen,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  getCourse,
  getCourseLessons,
  getProgress,
  saveProgress,
  streamUrl,
  toErrorMessage,
} from '../api/client';
import Badge from '../components/common/Badge.jsx';
import Button from '../components/common/Button.jsx';
import ProgressBar from '../components/common/ProgressBar.jsx';
import Curriculum from '../components/courses/Curriculum.jsx';
import VideoPlayer from '../components/VideoPlayer.jsx';
import { ErrorState, LoadingState } from '../components/States.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDuration } from '../utils/format.js';

/** Progress is pushed to the API at most this often while the video plays. */
const SAVE_INTERVAL_MS = 8000;

/** Per-lesson notes are local to the browser until a notes API exists. */
const notesKey = (lessonId) => `lms.notes.${lessonId}`;

export default function CourseLearning() {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const { student } = useAuth();

  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [resumeAt, setResumeAt] = useState(0);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [notes, setNotes] = useState('');

  const lastSavedAt = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
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

  /**
   * Throttled progress save: every 8s while playing, plus immediately on
   * pause and on end. Unchanged in behaviour from the original player.
   */
  const handleProgress = useCallback(
    (position, duration, force = false) => {
      if (!duration) return;

      const now = Date.now();
      if (!force && now - lastSavedAt.current < SAVE_INTERVAL_MS) return;
      lastSavedAt.current = now;

      saveProgress({ lessonId, position, duration })
        .then((saved) => {
          setLessons((prev) =>
            prev.map((l) =>
              l._id === lessonId
                ? {
                    ...l,
                    progress: {
                      position: saved.position,
                      percent: saved.percent,
                      completed: saved.completed,
                      updatedAt: saved.updatedAt,
                    },
                  }
                : l
            )
          );
        })
        .catch(() => {
          /* progress saving is best-effort — never interrupt playback */
        });
    },
    [lessonId]
  );

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
          lessons={lessons}
          courseId={courseId}
          activeLessonId={lessonId}
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
              <VideoPlayer
                key={lesson._id}
                src={streamUrl(lesson._id)}
                startAt={resumeAt}
                watermark={{ name: student?.name, label: 'AnalyticsAvenue EduTech' }}
                onProgress={handleProgress}
                onEnded={() => next && goTo(next)}
              />
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

                <div className="mt-6 flex items-center justify-between gap-3 border-t border-ink-100 pt-5">
                  <Button
                    variant="secondary"
                    onClick={() => previous && goTo(previous)}
                    disabled={!previous}
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Previous</span>
                  </Button>

                  <Button onClick={() => next && goTo(next)} disabled={!next}>
                    <span className="hidden sm:inline">Next lesson</span>
                    <span className="sm:hidden">Next</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </section>

              <div className="grid gap-6 lg:grid-cols-2">
                <section className="card min-w-0 p-5">
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
                  <p className="mt-2 text-[11px] text-ink-500">
                    Saved in this browser. Notes sync once the notes API is available.
                  </p>
                </section>

                <section className="card min-w-0 p-5">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-ink-400" aria-hidden="true" />
                    <h2 className="text-sm font-semibold text-ink-900">Resources</h2>
                  </div>
                  <p className="mt-3 text-[13px] leading-relaxed text-ink-600">
                    This lesson has no downloadable attachments. Lesson resources will be listed
                    here once the API exposes them.
                  </p>

                  <div className="mt-5 border-t border-ink-100 pt-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                      <h3 className="text-[13px] font-semibold text-ink-900">Secure delivery</h3>
                    </div>
                    <dl className="mt-2.5 space-y-1.5 text-[12px]">
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="text-ink-500">Browser requests</dt>
                        <dd className="break-all font-mono text-emerald-700">{streamUrl(lesson._id)}</dd>
                      </div>
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="text-ink-500">Browser never sees</dt>
                        <dd className="font-mono text-ink-400 line-through">
                          drive.google.com/file/…
                        </dd>
                      </div>
                    </dl>
                  </div>
                </section>
              </div>
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
