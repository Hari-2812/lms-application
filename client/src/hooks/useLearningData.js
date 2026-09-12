import { useEffect, useMemo, useState } from 'react';
import { getCourseLessons, getCourses, toErrorMessage } from '../api/client';

const HOUR = 3600;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Loads the catalogue plus every course's lessons (with this student's
 * progress) and derives the figures the dashboard, certificates and
 * achievements pages show.
 *
 * Every number below comes from the API — nothing is estimated. When a course
 * has no progress rows the derived values are simply zero.
 */
export default function useLearningData() {
  const [courses, setCourses] = useState([]);
  const [lessonsByCourse, setLessonsByCourse] = useState({});
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    getCourses()
      .then(async (courseList) => {
        // Progress, certificates and achievements only make sense for
        // courses the student can actually open — admin-restricted ones
        // stay in the catalogue but drop out of every derived figure here.
        const accessible = courseList.filter((c) => c.hasAccess !== false);

        // The catalogue is small, so one parallel round-trip is cheaper than
        // asking each page to fetch lessons on its own.
        const lessonLists = await Promise.all(
          accessible.map((course) => getCourseLessons(course._id).catch(() => []))
        );
        if (cancelled) return;

        setCourses(accessible);
        setLessonsByCourse(
          Object.fromEntries(accessible.map((course, i) => [course._id, lessonLists[i]]))
        );
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
  }, []);

  const derived = useMemo(() => {
    const allLessons = courses.flatMap((course) =>
      (lessonsByCourse[course._id] || []).map((lesson) => ({ ...lesson, course }))
    );

    const watchedSeconds = allLessons.reduce(
      (sum, lesson) => sum + (lesson.progress?.position || 0),
      0
    );

    const completedLessons = allLessons.filter((l) => l.progress?.completed);
    const startedCourses = courses.filter((c) => c.progress > 0);
    const completedCourses = courses.filter((c) => c.progress >= 100);

    /** The course to resume: furthest along without being finished. */
    const inProgress = courses
      .filter((c) => c.progress > 0 && c.progress < 100)
      .sort((a, b) => b.progress - a.progress);

    const continueCourse = inProgress[0] || courses.find((c) => c.progress < 100) || courses[0] || null;
    const continueLessons = continueCourse ? lessonsByCourse[continueCourse._id] || [] : [];
    const nextLesson = continueLessons.find((lesson) => !lesson.progress?.completed) || null;

    /** Newest-first activity feed built from real progress timestamps. */
    const activity = allLessons
      .filter((lesson) => lesson.progress?.updatedAt)
      .sort((a, b) => new Date(b.progress.updatedAt) - new Date(a.progress.updatedAt))
      .slice(0, 8)
      .map((lesson) => ({
        id: lesson._id,
        type: lesson.progress.completed ? 'completed' : 'watched',
        lessonTitle: lesson.title,
        courseTitle: lesson.course.title,
        courseId: lesson.course._id,
        lessonId: lesson._id,
        percent: lesson.progress.percent,
        at: lesson.progress.updatedAt,
      }));

    const since = Date.now() - WEEK_MS;
    const completedThisWeek = completedLessons.filter(
      (l) => l.progress.updatedAt && new Date(l.progress.updatedAt).getTime() >= since
    ).length;

    return {
      allLessons,
      lessonsFor: (courseId) => lessonsByCourse[courseId] || [],
      totalLessons: allLessons.length,
      completedLessonCount: completedLessons.length,
      lessonsRemaining: allLessons.length - completedLessons.length,
      watchedSeconds,
      hoursLearned: watchedSeconds / HOUR,
      startedCourses,
      completedCourses,
      continueCourse,
      nextLesson,
      activity,
      completedThisWeek,
    };
  }, [courses, lessonsByCourse]);

  return { courses, status, error, ...derived };
}
