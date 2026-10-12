import { useState, useEffect } from 'react';
import {
  getCourses, createCourse, addLesson, deleteCourse, deleteLesson, updateCourse, updateLesson, getCourseLessons,
  getStudents, getStudentAccess, grantAccess, revokeAccess,
  getCourseResources, addResource, deleteResource, getCourseStats, toErrorMessage,
  getEnrollments, confirmEnrollment, cancelEnrollment, broadcastNotification,
} from '../api/client';
import {
  Loader2, Plus, Link as LinkIcon, BookOpen, AlertCircle, CheckCircle2, Trash2,
  ChevronDown, ChevronUp, Pencil, X, Save, Users, Lock, Unlock, FileText, Layers, UserCheck, BarChart3,
  Bell, IndianRupee, Send,
} from 'lucide-react';
import { usePageMeta } from '../components/layout/DashboardLayout.jsx';
import StatsCard from '../components/dashboard/StatsCard.jsx';
import ProgressBar from '../components/common/ProgressBar.jsx';
import Badge from '../components/common/Badge.jsx';
import Button from '../components/common/Button.jsx';
import Input from '../components/common/Input.jsx';
import CourseContentEditor from '../components/admin/CourseContentEditor.jsx';
import EventManager from '../components/admin/EventManager.jsx';
import SubmissionReview from '../components/admin/SubmissionReview.jsx';

export default function AdminDashboard() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Overview chart State
  const [courseStats, setCourseStats] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);

  // Course Form State
  const [newCourse, setNewCourse] = useState({
    title: '',
    slug: '',
    description: '',
    instructor: '',
    level: 'Beginner'
  });
  const [creatingCourse, setCreatingCourse] = useState(false);

  // Lesson Form State
  const [newLesson, setNewLesson] = useState({
    courseId: '',
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    driveLink: ''
  });
  const [addingLesson, setAddingLesson] = useState(false);

  // Resource Form State
  const [newResource, setNewResource] = useState({
    courseId: '',
    title: '',
    description: '',
    url: '',
    type: 'pdf',
  });
  const [addingResource, setAddingResource] = useState(false);

  // List State
  const [expandedCourseId, setExpandedCourseId] = useState(null);
  const [courseLessons, setCourseLessons] = useState({});
  const [loadingLessons, setLoadingLessons] = useState({});
  const [courseResources, setCourseResources] = useState({});
  const [loadingResources, setLoadingResources] = useState({});

  // Edit State
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [editingCourseData, setEditingCourseData] = useState(null);
  const [editingLessonId, setEditingLessonId] = useState(null);
  const [editingLessonData, setEditingLessonData] = useState(null);

  // Enrolments awaiting payment confirmation
  const [enrollments, setEnrollments] = useState([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(true);
  const [confirmingEnrollment, setConfirmingEnrollment] = useState({});

  // Announcement composer
  const [announcement, setAnnouncement] = useState({
    type: 'announcement',
    title: '',
    message: '',
    courseId: '',
    studentId: '',
    link: '',
  });
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);

  // Student access State
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [expandedStudentId, setExpandedStudentId] = useState(null);
  const [studentAccess, setStudentAccess] = useState({});
  const [loadingAccess, setLoadingAccess] = useState({});
  const [togglingAccess, setTogglingAccess] = useState({});

  usePageMeta('Admin Dashboard', 'Manage courses, students and who has access to what.');

  useEffect(() => {
    fetchCourses();
    fetchStudents();
    fetchCourseStats();
    fetchEnrollments();
  }, []);

  const fetchEnrollments = async () => {
    try {
      const data = await getEnrollments();
      setEnrollments(data);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoadingEnrollments(false);
    }
  };

  const fetchCourseStats = async () => {
    try {
      const data = await getCourseStats();
      setCourseStats(data);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const data = await getStudents();
      setStudents(data);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoadingStudents(false);
    }
  };

  const toggleStudentExpansion = async (studentId) => {
    if (expandedStudentId === studentId) {
      setExpandedStudentId(null);
      return;
    }
    setExpandedStudentId(studentId);

    if (!studentAccess[studentId]) {
      setLoadingAccess((prev) => ({ ...prev, [studentId]: true }));
      try {
        const access = await getStudentAccess(studentId);
        setStudentAccess((prev) => ({ ...prev, [studentId]: access }));
      } catch (err) {
        setError(toErrorMessage(err));
      } finally {
        setLoadingAccess((prev) => ({ ...prev, [studentId]: false }));
      }
    }
  };

  const handleToggleAccess = async (studentId, courseId, currentlyGranted) => {
    const key = `${studentId}:${courseId}`;
    setTogglingAccess((prev) => ({ ...prev, [key]: true }));
    try {
      if (currentlyGranted) await revokeAccess(studentId, courseId);
      else await grantAccess(studentId, courseId);

      setStudentAccess((prev) => ({
        ...prev,
        [studentId]: prev[studentId].map((c) =>
          c.courseId === courseId ? { ...c, granted: !currentlyGranted } : c
        ),
      }));
      setStudents((prev) =>
        prev.map((s) =>
          s.id === studentId ? { ...s, accessCount: s.accessCount + (currentlyGranted ? -1 : 1) } : s
        )
      );
      setCourseStats((prev) =>
        prev.map((s) =>
          s.courseId === courseId
            ? { ...s, enrolledCount: s.enrolledCount + (currentlyGranted ? -1 : 1) }
            : s
        )
      );
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setTogglingAccess((prev) => ({ ...prev, [key]: false }));
    }
  };

  const fetchCourses = async () => {
    try {
      const data = await getCourses();
      setCourses(data);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setCreatingCourse(true);
    try {
      const created = await createCourse(newCourse);
      setCourses([...courses, created]);
      setSuccess(`Course "${created.title}" created successfully!`);
      setNewCourse({ title: '', slug: '', description: '', instructor: '', level: 'Beginner' });
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setCreatingCourse(false);
    }
  };

  const handleAddLesson = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setAddingLesson(true);
    try {
      const created = await addLesson(newLesson);
      setSuccess(`Lesson "${created.title}" added successfully!`);
      setNewLesson({ ...newLesson, title: '', description: '', driveLink: '' });
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setAddingLesson(false);
    }
  };

  const handleAddResource = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setAddingResource(true);
    try {
      const created = await addResource(newResource);
      setCourseResources((prev) =>
        prev[newResource.courseId]
          ? { ...prev, [newResource.courseId]: [...prev[newResource.courseId], created] }
          : prev
      );
      setSuccess(`Resource "${created.title}" added successfully!`);
      setNewResource({ ...newResource, title: '', description: '', url: '' });
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setAddingResource(false);
    }
  };

  const handleDeleteResource = async (resourceId, resourceTitle, courseId) => {
    if (!window.confirm(`Are you sure you want to delete the resource "${resourceTitle}"?`)) return;

    try {
      await deleteResource(resourceId);
      setCourseResources((prev) => ({
        ...prev,
        [courseId]: prev[courseId].filter((r) => r.id !== resourceId),
      }));
      setSuccess(`Resource "${resourceTitle}" deleted successfully`);
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  const toggleCourseExpansion = async (courseId) => {
    if (expandedCourseId === courseId) {
      setExpandedCourseId(null);
      return;
    }
    setExpandedCourseId(courseId);

    if (!courseLessons[courseId]) {
      setLoadingLessons((prev) => ({ ...prev, [courseId]: true }));
      try {
        const lessons = await getCourseLessons(courseId);
        setCourseLessons((prev) => ({ ...prev, [courseId]: lessons }));
      } catch (err) {
        setError(toErrorMessage(err));
      } finally {
        setLoadingLessons((prev) => ({ ...prev, [courseId]: false }));
      }
    }

    if (!courseResources[courseId]) {
      setLoadingResources((prev) => ({ ...prev, [courseId]: true }));
      try {
        const resources = await getCourseResources(courseId);
        setCourseResources((prev) => ({ ...prev, [courseId]: resources }));
      } catch (err) {
        setError(toErrorMessage(err));
      } finally {
        setLoadingResources((prev) => ({ ...prev, [courseId]: false }));
      }
    }
  };

  const handleDeleteCourse = async (courseId, courseTitle) => {
    if (!window.confirm(`Are you sure you want to delete the course "${courseTitle}" and ALL its lessons?`)) return;

    try {
      await deleteCourse(courseId);
      setCourses(courses.filter((c) => c._id !== courseId));
      setSuccess(`Course "${courseTitle}" deleted successfully`);
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  const handleDeleteLesson = async (lessonId, lessonTitle, courseId) => {
    if (!window.confirm(`Are you sure you want to delete the lesson "${lessonTitle}"?`)) return;

    try {
      await deleteLesson(lessonId);
      setCourseLessons((prev) => ({
        ...prev,
        [courseId]: prev[courseId].filter((l) => l._id !== lessonId),
      }));
      setSuccess(`Lesson "${lessonTitle}" deleted successfully`);
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  const startEditCourse = (e, course) => {
    e.stopPropagation();
    setEditingCourseId(course._id);
    setEditingCourseData({ title: course.title, slug: course.slug, description: course.description });
  };

  const handleSaveCourseEdit = async (e, courseId) => {
    e.stopPropagation();
    try {
      const updated = await updateCourse(courseId, editingCourseData);
      setCourses(courses.map((c) => (c._id === courseId ? { ...c, ...updated } : c)));
      setEditingCourseId(null);
      setSuccess('Course updated successfully');
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  /**
   * Saves the full content panel for one course. Throws on failure so the
   * editor can surface the message inline next to its own save button
   * instead of only in the page-level banner.
   */
  const handleSaveCourseContent = async (courseId, payload) => {
    try {
      const updated = await updateCourse(courseId, payload);
      setCourses((prev) => prev.map((c) => (c._id === courseId ? { ...c, ...updated } : c)));
      setSuccess(`"${updated.title}" updated`);
      setError('');
      return updated;
    } catch (err) {
      throw new Error(toErrorMessage(err));
    }
  };

  const handleConfirmEnrollment = async (enrollment) => {
    const reference = window.prompt(
      `Payment reference for ${enrollment.studentId?.name || 'this student'} (optional)`,
      ''
    );
    // prompt() returns null on Cancel and '' when submitted empty — only the
    // former should abort.
    if (reference === null) return;

    setConfirmingEnrollment((prev) => ({ ...prev, [enrollment._id]: true }));
    try {
      await confirmEnrollment(enrollment._id, reference);
      setEnrollments((prev) =>
        prev.map((e) => (e._id === enrollment._id ? { ...e, status: 'completed' } : e))
      );
      setSuccess('Payment confirmed and course access granted');
      // The grant changes both the access counts and the enrolment chart.
      fetchStudents();
      fetchCourseStats();
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setConfirmingEnrollment((prev) => ({ ...prev, [enrollment._id]: false }));
    }
  };

  const handleCancelEnrollment = async (enrollment) => {
    if (!window.confirm('Cancel this enrolment? The student will be notified.')) return;

    try {
      await cancelEnrollment(enrollment._id);
      setEnrollments((prev) =>
        prev.map((e) => (e._id === enrollment._id ? { ...e, status: 'cancelled' } : e))
      );
      setSuccess('Enrolment cancelled');
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  const handleSendAnnouncement = async (e) => {
    e.preventDefault();
    setSendingAnnouncement(true);
    try {
      const result = await broadcastNotification({
        type: announcement.type,
        title: announcement.title || undefined,
        message: announcement.message,
        courseId: announcement.courseId || undefined,
        studentId: announcement.studentId || undefined,
        link: announcement.link || undefined,
      });
      setSuccess(
        `Notification sent to ${result.targeted} ${result.targeted === 1 ? 'student' : 'students'}`
      );
      setAnnouncement({ type: 'announcement', title: '', message: '', courseId: '', studentId: '', link: '' });
      setError('');
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSendingAnnouncement(false);
    }
  };

  const startEditLesson = (lesson) => {
    setEditingLessonId(lesson._id);
    setEditingLessonData({
      title: lesson.title,
      description: lesson.description || '',
      date: lesson.date ? lesson.date.split('T')[0] : '',
    });
  };

  const handleSaveLessonEdit = async (courseId, lessonId) => {
    try {
      const updated = await updateLesson(lessonId, editingLessonData);
      setCourseLessons((prev) => ({
        ...prev,
        [courseId]: prev[courseId].map((l) => (l._id === lessonId ? { ...l, ...updated } : l)),
      }));
      setEditingLessonId(null);
      setSuccess('Lesson updated successfully');
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  const totalLessons = courses.reduce((sum, c) => sum + (c.lessons?.length || 0), 0);
  const totalGrants = students.reduce((sum, s) => sum + s.accessCount, 0);
  const maxEnrolled = Math.max(1, ...courseStats.map((s) => s.enrolledCount));
  const enrolledByCourse = new Map(courseStats.map((s) => [s.courseId, s.enrolledCount]));
  const pendingEnrollments = enrollments.filter((e) => e.status === 'pending');

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <p>{success}</p>
        </div>
      )}

      {/* --- Overview stats ---------------------------------------------
          Each figure links down to the section that manages it, so the
          numbers are a way into the work rather than just a readout. */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          icon={BookOpen}
          label="Total courses"
          value={courses.length}
          tone="primary"
          to="#manage-courses"
        />
        <StatsCard
          icon={Users}
          label="Total students"
          value={students.length}
          tone="success"
          to="#student-access"
        />
        <StatsCard
          icon={Layers}
          label="Total lessons"
          value={totalLessons}
          tone="warning"
          to="#manage-courses"
        />
        <StatsCard
          icon={UserCheck}
          label="Access grants"
          value={totalGrants}
          hint={
            pendingEnrollments.length
              ? `${pendingEnrollments.length} payment${pendingEnrollments.length === 1 ? '' : 's'} awaiting confirmation`
              : undefined
          }
          tone="neutral"
          to="#enrolments"
        />
      </section>

      {/* --- Enrollment chart --------------------------------------------- */}
      <section className="card p-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary-600" aria-hidden="true" />
          <h2 className="text-base font-semibold text-ink-900">Enrollment by course</h2>
        </div>
        <p className="mt-1 text-[13px] text-ink-500">
          How many students currently have access to each course.
        </p>

        {loadingStats ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-ink-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : courseStats.length === 0 ? (
          <p className="mt-6 text-sm text-ink-500">No courses yet.</p>
        ) : (
          <div className="mt-6 space-y-4">
            {courseStats.map((stat) => (
              <div key={stat.courseId}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-ink-700">{stat.title}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-ink-900">
                    {stat.enrolledCount} enrolled
                  </span>
                </div>
                <ProgressBar
                  value={(stat.enrolledCount / maxEnrolled) * 100}
                  label={`${stat.title} enrollment`}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* --- Enrolments awaiting payment confirmation --------------------- */}
      {/* scroll-mt clears the sticky dashboard header when the overview
          cards link down to these sections. */}
      <section id="enrolments" className="card scroll-mt-20 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 p-6">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
              <IndianRupee className="h-4 w-4 text-primary-600" aria-hidden="true" />
              Enrolments &amp; payments
            </h2>
            <p className="mt-1 text-[13px] text-ink-500">
              Confirming a payment grants the student access to the course.
            </p>
          </div>
          {pendingEnrollments.length > 0 && (
            <Badge tone="warning">{pendingEnrollments.length} awaiting confirmation</Badge>
          )}
        </div>

        {loadingEnrollments ? (
          <div className="flex items-center gap-2 p-6 text-sm text-ink-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading enrolments...
          </div>
        ) : enrollments.length === 0 ? (
          <p className="p-6 text-sm text-ink-500">
            No enrolments yet. They appear here when a student checks out from a course page.
          </p>
        ) : (
          <div className="divide-y divide-ink-100">
            {enrollments.slice(0, 25).map((enrollment) => (
              <div
                key={enrollment._id}
                className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-900">
                    {enrollment.studentId?.name || 'Unknown student'}
                    <span className="font-normal text-ink-500"> · {enrollment.courseId?.title || 'Deleted course'}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {enrollment.amount > 0
                      ? `₹${Number(enrollment.amount).toLocaleString('en-IN')}`
                      : 'Free'}
                    {enrollment.method ? ` · ${enrollment.method}` : ''}
                    {' · '}
                    {new Date(enrollment.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                    {enrollment.reference ? ` · ref ${enrollment.reference}` : ''}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {enrollment.status === 'pending' && <Badge tone="warning">Pending</Badge>}
                  {enrollment.status === 'completed' && <Badge tone="success">Confirmed</Badge>}
                  {enrollment.status === 'cancelled' && <Badge tone="neutral">Cancelled</Badge>}

                  {enrollment.status === 'pending' && (
                    <>
                      <Button
                        size="sm"
                        loading={confirmingEnrollment[enrollment._id]}
                        disabled={confirmingEnrollment[enrollment._id]}
                        onClick={() => handleConfirmEnrollment(enrollment)}
                      >
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleCancelEnrollment(enrollment)}
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* --- Upcoming events ---------------------------------------------- */}
      <EventManager courses={courses} />

      {/* --- Task submission review --------------------------------------- */}
      <SubmissionReview />

      {/* --- Notification composer ---------------------------------------- */}
      <section className="card p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
          <Bell className="h-4 w-4 text-primary-600" aria-hidden="true" />
          Send a notification
        </h2>
        <p className="mt-1 text-[13px] text-ink-500">
          Goes straight to the bell icon in the student dashboard, in real time.
        </p>

        <form onSubmit={handleSendAnnouncement} className="mt-5 grid gap-4 lg:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="notification-type">
              Type
            </label>
            <select
              id="notification-type"
              className="field-input"
              value={announcement.type}
              onChange={(e) => setAnnouncement({ ...announcement, type: e.target.value })}
            >
              <option value="announcement">Announcement</option>
              <option value="course_update">Course update</option>
              <option value="task">Task / assignment</option>
              <option value="event">Upcoming event</option>
              <option value="certificate">Certificate update</option>
            </select>
          </div>

          <Input
            label="Title"
            value={announcement.title}
            onChange={(e) => setAnnouncement({ ...announcement, title: e.target.value })}
            placeholder="Leave empty to use the type's default"
          />

          <div className="lg:col-span-2">
            <label className="field-label" htmlFor="notification-message">
              Message
            </label>
            <textarea
              id="notification-message"
              required
              className="field-input min-h-[90px] resize-y"
              value={announcement.message}
              onChange={(e) => setAnnouncement({ ...announcement, message: e.target.value })}
              placeholder="What do you want students to know?"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="notification-course">
              Course (optional)
            </label>
            <select
              id="notification-course"
              className="field-input"
              value={announcement.courseId}
              onChange={(e) => setAnnouncement({ ...announcement, courseId: e.target.value, studentId: '' })}
            >
              <option value="">All students</option>
              {courses.map((course) => (
                <option key={course._id} value={course._id}>
                  Students with access to {course.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="notification-student">
              Single student (optional)
            </label>
            <select
              id="notification-student"
              className="field-input"
              value={announcement.studentId}
              onChange={(e) => setAnnouncement({ ...announcement, studentId: e.target.value })}
            >
              <option value="">—</option>
              {students.map((student) => (
                <option key={student._id} value={student._id}>
                  {student.name} ({student.email})
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-ink-500">Overrides the course selection.</p>
          </div>

          <Input
            label="Link (optional)"
            value={announcement.link}
            onChange={(e) => setAnnouncement({ ...announcement, link: e.target.value })}
            placeholder="/certificates"
            hint="An in-app path. Clicking the notification takes the student here."
            className="lg:col-span-2"
          />

          <div className="lg:col-span-2">
            <Button type="submit" loading={sendingAnnouncement} disabled={sendingAnnouncement}>
              <Send className="h-4 w-4" aria-hidden="true" />
              Send notification
            </Button>
          </div>
        </form>
      </section>

      {/* --- Create course / add lesson ----------------------------------- */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
            <Plus className="h-4 w-4 text-primary-600" aria-hidden="true" />
            Create course
          </h2>

          <form onSubmit={handleCreateCourse} className="mt-5 flex flex-col gap-4">
            <Input
              label="Course title"
              required
              placeholder="e.g. Advanced Python Programming"
              value={newCourse.title}
              onChange={(e) => {
                const title = e.target.value;
                const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
                setNewCourse({ ...newCourse, title, slug });
              }}
            />
            <Input
              label="URL slug"
              required
              value={newCourse.slug}
              onChange={(e) => setNewCourse({ ...newCourse, slug: e.target.value })}
            />
            <div>
              <label className="field-label">Description</label>
              <textarea
                className="field-input min-h-[100px] resize-y"
                value={newCourse.description}
                onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
              />
            </div>

            <Button type="submit" loading={creatingCourse} disabled={creatingCourse} fullWidth>
              Create course
            </Button>
          </form>
        </div>

        <div className="card p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
            <LinkIcon className="h-4 w-4 text-primary-600" aria-hidden="true" />
            Add Drive lesson
          </h2>

          <form onSubmit={handleAddLesson} className="mt-5 flex flex-col gap-4">
            <div>
              <label className="field-label">Select course</label>
              <select
                required
                className="field-input"
                value={newLesson.courseId}
                onChange={(e) => setNewLesson({ ...newLesson, courseId: e.target.value })}
              >
                <option value="" disabled>Choose a course...</option>
                {courses.map((course) => (
                  <option key={course._id} value={course._id}>{course.title}</option>
                ))}
              </select>
            </div>

            <Input
              label="Lesson title"
              required
              placeholder="e.g. 1. Introduction to Variables"
              value={newLesson.title}
              onChange={(e) => setNewLesson({ ...newLesson, title: e.target.value })}
            />

            <div>
              <label className="field-label">Description</label>
              <textarea
                className="field-input min-h-[80px] resize-y"
                placeholder="Brief summary of the lesson..."
                value={newLesson.description}
                onChange={(e) => setNewLesson({ ...newLesson, description: e.target.value })}
              />
            </div>

            <Input
              label="Date"
              type="date"
              required
              value={newLesson.date}
              onChange={(e) => setNewLesson({ ...newLesson, date: e.target.value })}
            />

            <Input
              label="Google Drive video link"
              type="url"
              required
              placeholder="https://drive.google.com/file/d/..."
              hint="The file must be shared with your service account. The server extracts the ID and securely proxies the stream."
              value={newLesson.driveLink}
              onChange={(e) => setNewLesson({ ...newLesson, driveLink: e.target.value })}
            />

            <Button type="submit" loading={addingLesson} disabled={addingLesson || !newLesson.courseId} fullWidth>
              Import &amp; add lesson
            </Button>
          </form>
        </div>
      </section>

      {/* --- Add study material -------------------------------------------- */}
      <section className="card p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
          <FileText className="h-4 w-4 text-primary-600" aria-hidden="true" />
          Add study material
        </h2>

        <form onSubmit={handleAddResource} className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label className="field-label">Select course</label>
            <select
              required
              className="field-input"
              value={newResource.courseId}
              onChange={(e) => setNewResource({ ...newResource, courseId: e.target.value })}
            >
              <option value="" disabled>Choose a course...</option>
              {courses.map((course) => (
                <option key={course._id} value={course._id}>{course.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">Type</label>
            <select
              className="field-input"
              value={newResource.type}
              onChange={(e) => setNewResource({ ...newResource, type: e.target.value })}
            >
              <option value="pdf">PDF</option>
              <option value="doc">Document</option>
              <option value="slides">Slides</option>
              <option value="link">Link</option>
            </select>
          </div>

          <Input
            label="Title"
            required
            placeholder="e.g. Week 1 Handout"
            value={newResource.title}
            onChange={(e) => setNewResource({ ...newResource, title: e.target.value })}
          />

          <Input
            label="Link (PDF / Drive / doc URL)"
            type="url"
            required
            placeholder="https://drive.google.com/file/d/..."
            value={newResource.url}
            onChange={(e) => setNewResource({ ...newResource, url: e.target.value })}
          />

          <div className="md:col-span-2">
            <label className="field-label">Description (optional)</label>
            <textarea
              className="field-input min-h-[80px] resize-y"
              placeholder="What this resource covers..."
              value={newResource.description}
              onChange={(e) => setNewResource({ ...newResource, description: e.target.value })}
            />
          </div>

          <Button
            type="submit"
            loading={addingResource}
            disabled={addingResource || !newResource.courseId}
            className="md:col-span-2"
            fullWidth
          >
            Add resource
          </Button>
        </form>
      </section>

      {/* --- Manage courses & lessons --------------------------------------- */}
      <section id="manage-courses" className="card scroll-mt-20 overflow-hidden">
        <div className="border-b border-ink-100 p-6">
          <h2 className="text-base font-semibold text-ink-900">Manage courses &amp; lessons</h2>
        </div>

        {courses.length === 0 ? (
          <p className="p-6 text-sm text-ink-500">No courses available yet. Create one above!</p>
        ) : (
          <div className="divide-y divide-ink-100">
            <div className="hidden grid-cols-[1fr_6rem_6rem_7rem] gap-4 px-6 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-400 sm:grid">
              <span>Course</span>
              <span>Lessons</span>
              <span>Enrolled</span>
              <span className="text-right">Actions</span>
            </div>

            {courses.map((course) => (
              <div key={course._id}>
                <div
                  className="flex cursor-pointer flex-col gap-3 px-6 py-4 transition hover:bg-surface-muted sm:grid sm:grid-cols-[1fr_6rem_6rem_7rem] sm:items-center sm:gap-4"
                  onClick={() => !editingCourseId && toggleCourseExpansion(course._id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary-600">
                      <BookOpen className="h-4 w-4" aria-hidden="true" />
                    </span>
                    {editingCourseId === course._id ? (
                      <div className="flex w-full flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          className="w-full rounded-md border border-ink-200 px-2.5 py-1 text-sm focus:border-primary-500 focus:outline-none"
                          value={editingCourseData.title}
                          onChange={(e) => setEditingCourseData({ ...editingCourseData, title: e.target.value })}
                          placeholder="Title"
                        />
                        <input
                          type="text"
                          className="w-full rounded-md border border-ink-200 px-2.5 py-1 text-sm focus:border-primary-500 focus:outline-none"
                          value={editingCourseData.slug}
                          onChange={(e) => setEditingCourseData({ ...editingCourseData, slug: e.target.value })}
                          placeholder="Slug"
                        />
                      </div>
                    ) : (
                      <p className="truncate text-sm font-medium text-ink-900">{course.title}</p>
                    )}
                  </div>

                  <span className="text-sm text-ink-600 sm:pl-0">
                    <span className="text-ink-400 sm:hidden">Lessons: </span>
                    {course.lessons?.length || 0}
                  </span>
                  <span className="text-sm text-ink-600">
                    <span className="text-ink-400 sm:hidden">Enrolled: </span>
                    {enrolledByCourse.get(String(course._id)) || 0}
                  </span>

                  <div className="flex items-center gap-1 sm:justify-end">
                    {editingCourseId === course._id ? (
                      <>
                        <button
                          onClick={(e) => handleSaveCourseEdit(e, course._id)}
                          className="rounded-lg p-2 text-emerald-600 transition hover:bg-emerald-50"
                          title="Save"
                        >
                          <Save className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingCourseId(null); }}
                          className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-100"
                          title="Cancel"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={(e) => startEditCourse(e, course)}
                          className="rounded-lg p-2 text-ink-400 transition hover:bg-primary-50 hover:text-primary-600"
                          title="Edit course"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteCourse(course._id, course.title); }}
                          className="rounded-lg p-2 text-ink-400 transition hover:bg-red-50 hover:text-red-600"
                          title="Delete course"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    <span className="text-ink-400">
                      {expandedCourseId === course._id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </span>
                  </div>
                </div>

                {expandedCourseId === course._id && (
                  <div className="space-y-5 border-t border-ink-100 bg-surface-muted px-6 py-5">
                    {/* Thumbnail, intro video, formatted copy, package and
                        pricing — everything the student-facing Browse
                        Courses and course details pages read. */}
                    <CourseContentEditor
                      course={course}
                      onSave={handleSaveCourseContent}
                      onSaved={fetchCourseStats}
                    />

                    <div>
                      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">Lessons</h4>
                      {loadingLessons[course._id] ? (
                        <div className="flex items-center gap-2 text-sm text-ink-500">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading lessons...
                        </div>
                      ) : courseLessons[course._id]?.length === 0 ? (
                        <p className="text-sm text-ink-500">No lessons added to this course yet.</p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {courseLessons[course._id]?.map((lesson) => (
                            <div key={lesson._id} className="flex flex-col gap-3 rounded-lg border border-ink-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex flex-1 items-center gap-3">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-medium text-primary-700">
                                  {lesson.order}
                                </span>

                                {editingLessonId === lesson._id ? (
                                  <div className="flex w-full flex-col gap-2">
                                    <div className="flex flex-col gap-2 sm:flex-row">
                                      <input
                                        type="text"
                                        className="w-full rounded-md border border-ink-200 px-2.5 py-1 text-sm focus:border-primary-500 focus:outline-none"
                                        value={editingLessonData.title}
                                        onChange={(e) => setEditingLessonData({ ...editingLessonData, title: e.target.value })}
                                        placeholder="Title"
                                      />
                                      <input
                                        type="date"
                                        className="w-full rounded-md border border-ink-200 px-2.5 py-1 text-sm focus:border-primary-500 focus:outline-none sm:w-36"
                                        value={editingLessonData.date}
                                        onChange={(e) => setEditingLessonData({ ...editingLessonData, date: e.target.value })}
                                      />
                                    </div>
                                    <textarea
                                      className="min-h-[60px] w-full rounded-md border border-ink-200 px-2.5 py-1 text-sm focus:border-primary-500 focus:outline-none"
                                      value={editingLessonData.description}
                                      onChange={(e) => setEditingLessonData({ ...editingLessonData, description: e.target.value })}
                                      placeholder="Lesson description..."
                                    />
                                  </div>
                                ) : (
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-ink-800">{lesson.title}</p>
                                    {lesson.description && (
                                      <p className="mt-0.5 truncate text-xs text-ink-500">{lesson.description}</p>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-1 self-end sm:self-auto">
                                {editingLessonId === lesson._id ? (
                                  <>
                                    <button
                                      onClick={() => handleSaveLessonEdit(course._id, lesson._id)}
                                      className="rounded-lg p-1.5 text-emerald-600 transition hover:bg-emerald-50"
                                      title="Save"
                                    >
                                      <Save className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => setEditingLessonId(null)}
                                      className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100"
                                      title="Cancel"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => startEditLesson(lesson)}
                                      className="rounded-lg p-1.5 text-ink-400 transition hover:bg-primary-50 hover:text-primary-600"
                                      title="Edit lesson"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteLesson(lesson._id, lesson.title, course._id)}
                                      className="rounded-lg p-1.5 text-ink-400 transition hover:bg-red-50 hover:text-red-600"
                                      title="Delete lesson"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">Study materials</h4>
                      {loadingResources[course._id] ? (
                        <div className="flex items-center gap-2 text-sm text-ink-500">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading resources...
                        </div>
                      ) : courseResources[course._id]?.length === 0 ? (
                        <p className="text-sm text-ink-500">No study materials added to this course yet.</p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {courseResources[course._id]?.map((resource) => (
                            <div key={resource.id} className="flex items-center justify-between gap-3 rounded-lg border border-ink-100 bg-white p-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                                  <FileText className="h-4 w-4" />
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-ink-800">{resource.title}</p>
                                  <a
                                    href={resource.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block truncate text-xs text-primary-600 hover:underline"
                                  >
                                    {resource.url}
                                  </a>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteResource(resource.id, resource.title, course._id)}
                                className="shrink-0 rounded-lg p-1.5 text-ink-400 transition hover:bg-red-50 hover:text-red-600"
                                title="Delete resource"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* --- Students & course access ---------------------------------------- */}
      <section id="student-access" className="card scroll-mt-20 overflow-hidden">
        <div className="border-b border-ink-100 p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
            <Users className="h-4 w-4 text-primary-600" aria-hidden="true" />
            Students &amp; course access
          </h2>
        </div>

        {loadingStudents ? (
          <div className="flex items-center gap-2 p-6 text-sm text-ink-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading students...
          </div>
        ) : students.length === 0 ? (
          <p className="p-6 text-sm text-ink-500">No students have registered yet.</p>
        ) : (
          <div className="divide-y divide-ink-100">
            <div className="hidden grid-cols-[1fr_9rem_9rem] gap-4 px-6 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-400 sm:grid">
              <span>Student</span>
              <span>Courses enrolled</span>
              <span className="text-right">Manage access</span>
            </div>

            {students.map((student) => (
              <div key={student.id}>
                <div className="flex flex-col gap-3 px-6 py-4 sm:grid sm:grid-cols-[1fr_9rem_9rem] sm:items-center sm:gap-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary-600">
                      <Users className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-900">{student.name}</p>
                      <p className="truncate text-xs text-ink-500">{student.email}</p>
                    </div>
                  </div>

                  <Badge tone={student.accessCount > 0 ? 'success' : 'neutral'} className="self-start sm:self-auto">
                    {student.accessCount} enrolled
                  </Badge>

                  <button
                    type="button"
                    onClick={() => toggleStudentExpansion(student.id)}
                    className="inline-flex items-center gap-1.5 self-start rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-700 transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 sm:justify-self-end"
                  >
                    Manage access
                    {expandedStudentId === student.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {expandedStudentId === student.id && (
                  <div className="border-t border-ink-100 bg-surface-muted p-5">
                    {loadingAccess[student.id] ? (
                      <div className="flex items-center gap-2 text-sm text-ink-500">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading access...
                      </div>
                    ) : (studentAccess[student.id]?.length || 0) === 0 ? (
                      <p className="text-sm text-ink-500">No courses exist yet.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {studentAccess[student.id].map((entry) => {
                          const key = `${student.id}:${entry.courseId}`;
                          return (
                            <div
                              key={entry.courseId}
                              className="flex items-center justify-between gap-3 rounded-lg border border-ink-100 bg-white p-3"
                            >
                              <span className="truncate text-sm font-medium text-ink-800">{entry.title}</span>
                              <button
                                type="button"
                                disabled={togglingAccess[key]}
                                onClick={() => handleToggleAccess(student.id, entry.courseId, entry.granted)}
                                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                  entry.granted
                                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                    : 'bg-primary-600 text-white hover:bg-primary-700'
                                }`}
                              >
                                {togglingAccess[key] ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : entry.granted ? (
                                  <Unlock className="h-3.5 w-3.5" />
                                ) : (
                                  <Lock className="h-3.5 w-3.5" />
                                )}
                                {entry.granted ? 'Revoke access' : 'Allow access'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
