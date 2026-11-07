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
import Badge from '../components/common/Badge.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import Skeleton from '../components/common/Skeleton.jsx';
import { ErrorState } from '../components/States.jsx';
import { getMyResources, toErrorMessage } from '../api/client';
import { safeExternalUrl } from '../utils/url.js';

const TYPE_ICON = { pdf: FileText, doc: FileText, slides: Presentation, link: LinkIcon };
const TYPE_LABEL = { pdf: 'PDF', doc: 'Document', slides: 'Slides', link: 'Link' };

/**
 * Every study material the learner can open, grouped by course: all of a
 * course's materials when they have the course (or Full Access), or just the
 * ones the admin shared with them.
 */
function CourseResourcesPanel({ group, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const { course, access, resources } = group;

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-ink-50"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-600">
            <BookOpen className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-900">{course.title}</p>
            <p className="text-xs text-ink-500">
              {resources.length} material{resources.length === 1 ? '' : 's'}
            </p>
          </div>
          {access === 'selected' && <Badge tone="neutral">Shared with you</Badge>}
        </div>
        {open ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-ink-400" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-ink-400" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div className="border-t border-ink-100 bg-surface-muted p-5">
          {resources.length === 0 ? (
            <p className="text-sm text-ink-500">No study materials have been added to this course yet.</p>
          ) : (
            <ul className="space-y-2">
              {resources.map((resource) => {
                const Icon = TYPE_ICON[resource.type] || FileText;
                const href = safeExternalUrl(resource.url);
                return (
                  <li key={resource.id}>
                    <a
                      href={href || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-3 rounded-xl bg-white p-3.5 shadow-sm transition hover:shadow-md"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary-600">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink-900">{resource.title}</span>
                        <span className="block truncate text-xs text-ink-500">
                          {TYPE_LABEL[resource.type] || 'File'}
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
    </div>
  );
}

export default function Resources() {
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState('');

  usePageMeta('Resources', 'Study materials and PDFs for your courses.');

  useEffect(() => {
    getMyResources()
      .then(setGroups)
      .catch((err) => setError(toErrorMessage(err)));
  }, []);

  if (error) return <ErrorState message={error} />;

  if (!groups) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 rounded-card" />
        <Skeleton className="h-20 rounded-card" />
        <Skeleton className="h-20 rounded-card" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No resources yet"
        description="Once you have access to a course, or study materials are shared with you, they show up here."
      />
    );
  }

  // Courses with materials first; open the first one so there is something to click straight away.
  const sorted = [...groups].sort((a, b) => Number(b.resources.length > 0) - Number(a.resources.length > 0));
  return (
    <div className="space-y-4">
      {sorted.map((group, index) => (
        <CourseResourcesPanel key={group.course._id} group={group} defaultOpen={index === 0 && group.resources.length > 0} />
      ))}
    </div>
  );
}
