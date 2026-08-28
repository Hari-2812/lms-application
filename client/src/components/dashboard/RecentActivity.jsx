import { Link } from 'react-router-dom';
import { Award, BookOpen, CheckCircle2, History, PlayCircle } from 'lucide-react';

const ICONS = {
  completed: { icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' },
  watched: { icon: PlayCircle, tone: 'bg-primary-50 text-primary-600' },
  certificate: { icon: Award, tone: 'bg-amber-50 text-amber-600' },
  enrolled: { icon: BookOpen, tone: 'bg-ink-100 text-ink-600' },
};

/** "3 hours ago" / "2 days ago" from an ISO timestamp. */
function relativeTime(value) {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';

  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`;

  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/**
 * Timeline of what the student actually did, ordered by the `updatedAt`
 * timestamps the progress API returns.
 */
export default function RecentActivity({ items = [], limit = 5 }) {
  return (
    <section className="card p-5" aria-labelledby="recent-activity-heading">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-ink-400" aria-hidden="true" />
        <h2 id="recent-activity-heading" className="text-sm font-semibold text-ink-900">
          Recent Activity
        </h2>
      </div>

      {items.length === 0 ? (
        <p className="mt-5 text-[13px] leading-relaxed text-ink-500">
          Nothing here yet — start a lesson and your activity will appear.
        </p>
      ) : (
        <ol className="mt-5 space-y-1">
          {items.slice(0, limit).map((item, index, shown) => {
            const { icon: Icon, tone } = ICONS[item.type] || ICONS.watched;
            const isLast = index === shown.length - 1;

            return (
              <li key={item.id} className="relative flex gap-3.5 pb-5 last:pb-0">
                {/* Timeline rail */}
                {!isLast && (
                  <span
                    className="absolute left-[15px] top-8 bottom-1 w-px bg-ink-100"
                    aria-hidden="true"
                  />
                )}

                <span className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tone}`}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>

                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-[13px] leading-snug text-ink-800">
                    {item.type === 'completed' ? 'Completed' : `Watched ${item.percent}% of`}{' '}
                    <Link
                      to={`/learn/${item.courseId}/${item.lessonId}`}
                      className="font-semibold text-ink-900 hover:text-primary-700"
                    >
                      {item.lessonTitle}
                    </Link>
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-ink-500">
                    {item.courseTitle} · {relativeTime(item.at)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
