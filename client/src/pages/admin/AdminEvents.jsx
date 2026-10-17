import { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { getCourses } from '../../api/client';
import { usePageMeta } from '../../components/layout/DashboardLayout.jsx';
import EventManager from '../../components/admin/EventManager.jsx';
import { PageHeader } from '../../components/admin/ui.jsx';

/** Admin → Events: webinars, workshops and sessions on the learners' Events page. */
export default function AdminEvents() {
  const [courses, setCourses] = useState([]);

  usePageMeta('Events', 'Sessions, webinars and workshops.');

  useEffect(() => {
    getCourses().then(setCourses).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CalendarClock}
        title="Events & sessions"
        description="Schedule webinars, workshops and live sessions. Learners are notified when a new event is published."
      />
      <EventManager courses={courses} />
    </div>
  );
}
