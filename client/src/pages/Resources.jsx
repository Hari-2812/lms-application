import { useEffect, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Link as LinkIcon,
  Presentation,
} from 'lucide-react';
import { usePageMeta } from '../components/layout/DashboardLayout.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import Skeleton from '../components/common/Skeleton.jsx';
import { ErrorState } from '../components/States.jsx';
import { getCourseResources, toErrorMessage } from '../api/client';
import useCourses from '../hooks/useCourses.js';

const TYPE_ICON = { pdf: FileText, doc: FileText, slides: Presentation, link: LinkIcon };

function CourseResourcesPanel({ course }) {
  const [open, setOpen] = useState(false);
  const [resources, setResources] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || resources !== null) return;
    setLoading(true);
    getCourseResources(course._id)
      .then(setResources)
      .catch((err) => setError(toErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [open, resources, course._id]);

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-ink-50"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-600">
            <BookOpen className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink-900">{course.title}</p>
            <p className="text-xs text-ink-500">{course.lessonCount} lessons</p>
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-ink-400" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-ink-400" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div className="border-t border-ink-100 bg-surface-muted p-5">
          {error ? (
            <ErrorState message={error} />
          ) : loading || resources === null ? (
            <div className="space-y-2">
              <Skeleton className="h-14 rounded-lg" />
              <Skeleton className="h-14 rounded-lg" />
            </div>
          ) : resources.length === 0 ? (
            <p className="text-sm text-ink-500">No study materials have been added to this course yet.</p>
          ) : (
            <ul className="space-y-2">
              {resources.map((resource) => {
                const Icon = TYPE_ICON[resource.type] || FileText;
                return (
                  <li key={resource.id}>
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-xl bg-white p-3.5 shadow-sm transition hover:shadow-md"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary-600">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink-900">
                          {resource.title}
                        </span>
                        {resource.description && (
                          <span className="block truncate text-xs text-ink-500">
                            {resource.description}
                          </span>
                        )}
                      </span>
                      <ExternalLink className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function Resources() {
  const { courses: allCourses, status, error } = useCourses();

  usePageMeta('Resources', 'Study materials and PDFs for the courses you have access to.');

  const courses = allCourses.filter((c) => c.hasAccess !== false);

  if (status === 'error') return <ErrorState message={error} />;

  if (status === 'loading') {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 rounded-card" />
        <Skeleton className="h-20 rounded-card" />
        <Skeleton className="h-20 rounded-card" />
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No resources yet"
        description="Once your admin grants you access to a course, its study materials will show up here."
      />
    );
  }

  return (
    <div className="space-y-4">
      {courses.map((course) => (
        <CourseResourcesPanel key={course._id} course={course} />
      ))}
    </div>
  );
}
