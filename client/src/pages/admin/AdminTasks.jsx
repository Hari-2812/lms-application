import { useEffect, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { getCourses } from '../../api/client';
import { usePageMeta } from '../../components/layout/DashboardLayout.jsx';
import AssignmentManager from '../../components/admin/AssignmentManager.jsx';
import SubmissionReview from '../../components/admin/SubmissionReview.jsx';
import { PageHeader } from '../../components/admin/ui.jsx';

/** Admin → Tasks & reviews: set assignments with due dates, review what comes back. */
export default function AdminTasks() {
  const [courses, setCourses] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  usePageMeta('Tasks & reviews', 'Assignments and the submission review queue.');

  useEffect(() => {
    getCourses().then(setCourses).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ClipboardCheck}
        title="Tasks & reviews"
        description="Create assignments with a due date, then review what learners submit. Feedback and scores reach the learner straight away."
      />
      <AssignmentManager courses={courses} onChanged={() => setRefreshKey((k) => k + 1)} />
      <SubmissionReview refreshKey={refreshKey} />
    </div>
  );
}
