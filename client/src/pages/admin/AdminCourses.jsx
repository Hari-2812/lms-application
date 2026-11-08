import { useEffect, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  FileText,
  Layers,
  Link as LinkIcon,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import {
  addLesson,
  addResource,
  createCourse,
  deleteCourse,
  deleteLesson,
  deleteResource,
  getCourseLessons,
  getCourseResources,
  getCourseStats,
  getCourses,
  toErrorMessage,
  updateCourse,
  updateLesson,
} from '../../api/client';
import { safeExternalUrl } from '../../utils/url.js';
import { usePageMeta } from '../../components/layout/DashboardLayout.jsx';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import CourseContentEditor from '../../components/admin/CourseContentEditor.jsx';
import { EmptyRow, LoadingRow, PageHeader, Panel, Pill, StatTile, formatMoney, useFlash } from '../../components/admin/ui.jsx';

/**
 * Admin → Courses: create courses, add Drive lessons and study material, and
 * edit everything the learner-facing catalogue shows. Pricing and
 * publishing changes are written to the activity log by the server, and
 * publishing a course notifies learners.
 */

const slugify = (title) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

export default function AdminCourses() {
  const flash = useFlash();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [courseStats, setCourseStats] = useState([]);

  const [newCourse, setNewCourse] = useState({ title: '', slug: '', description: '', price: '', published: true });
  const [creatingCourse, setCreatingCourse] = useState(false);

  const [newLesson, setNewLesson] = useState({
    courseId: '',
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    driveLink: '',
  });
  const [addingLesson, setAddingLesson] = useState(false);

  const [newResource, setNewResource] = useState({ courseId: '', title: '', description: '', url: '', type: 'pdf' });
  const [addingResource, setAddingResource] = useState(false);

  const [expandedCourseId, setExpandedCourseId] = useState(null);
  const [courseLessons, setCourseLessons] = useState({});
  const [loadingLessons, setLoadingLessons] = useState({});
  const [courseResources, setCourseResources] = useState({});
  const [loadingResources, setLoadingResources] = useState({});

  const [editingCourseId, setEditingCourseId] = useState(null);
  const [editingCourseData, setEditingCourseData] = useState(null);
  const [editingLessonId, setEditingLessonId] = useState(null);
  const [editingLessonData, setEditingLessonData] = useState(null);

  usePageMeta('Courses', 'Courses, lessons and study material.');

  const fetchCourseStats = () => getCourseStats().then(setCourseStats).catch(() => {});

  useEffect(() => {
    getCourses()
      .then(setCourses)
      .catch((err) => flash.error(toErrorMessage(err)))
      .finally(() => setLoading(false));
    fetchCourseStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    setCreatingCourse(true);
    try {
      const created = await createCourse({
        title: newCourse.title,
        slug: newCourse.slug,
        description: newCourse.description,
        price: newCourse.price === '' ? 0 : Number(newCourse.price),
        published: newCourse.published,
        notifyStudents: newCourse.published,
      });
      setCourses((prev) => [...prev, created]);
      flash.success(
        `Course "${created.title}" created${created.published === false ? ' as a draft' : ' and learners notified'}. Add lessons below.`
      );
      setNewCourse({ title: '', slug: '', description: '', price: '', published: true });
      fetchCourseStats();
    } catch (err) {
      flash.error(toErrorMessage(err));
    } finally {
      setCreatingCourse(false);
    }
  };

  const handleAddLesson = async (e) => {
    e.preventDefault();
    setAddingLesson(true);
    try {
      const created = await addLesson(newLesson);
      flash.success(`Lesson "${created.title}" added.`);
      setCourseLessons((prev) =>
        prev[newLesson.courseId] ? { ...prev, [newLesson.courseId]: [...prev[newLesson.courseId], created] } : prev
      );
      setCourses((prev) =>
        prev.map((c) => (c._id === newLesson.courseId ? { ...c, lessons: [...(c.lessons || []), created._id] } : c))
      );
      setNewLesson({ ...newLesson, title: '', description: '', driveLink: '' });
    } catch (err) {
      flash.error(toErrorMessage(err));
    } finally {
      setAddingLesson(false);
    }
  };

  const handleAddResource = async (e) => {
    e.preventDefault();
    if (!safeExternalUrl(newResource.url)) {
      flash.error('The material link must be a full link starting with https://');
      return;
    }
    setAddingResource(true);
    try {
      const created = await addResource(newResource);
      setCourseResources((prev) =>
        prev[newResource.courseId] ? { ...prev, [newResource.courseId]: [...prev[newResource.courseId], created] } : prev
      );
      flash.success(`Resource "${created.title}" added. Learners with this course can open it from the Resources button under each lesson.`);
      setNewResource({ ...newResource, title: '', description: '', url: '' });
    } catch (err) {
      flash.error(toErrorMessage(err));
    } finally {
      setAddingResource(false);
    }
  };

  const handleDeleteResource = async (resourceId, resourceTitle, courseId) => {
    if (!window.confirm(`Delete the resource "${resourceTitle}"?`)) return;
    try {
      await deleteResource(resourceId);
      setCourseResources((prev) => ({ ...prev, [courseId]: prev[courseId].filter((r) => r.id !== resourceId) }));
      flash.success(`Resource "${resourceTitle}" deleted.`);
    } catch (err) {
      flash.error(toErrorMessage(err));
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
        flash.error(toErrorMessage(err));
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
        flash.error(toErrorMessage(err));
      } finally {
        setLoadingResources((prev) => ({ ...prev, [courseId]: false }));
      }
    }
  };

  const handleDeleteCourse = async (courseId, courseTitle) => {
    if (!window.confirm(`Delete the course "${courseTitle}" and ALL its lessons? This cannot be undone.`)) return;
    try {
      await deleteCourse(courseId);
      setCourses((prev) => prev.filter((c) => c._id !== courseId));
      flash.success(`Course "${courseTitle}" deleted.`);
    } catch (err) {
      flash.error(toErrorMessage(err));
    }
  };

  const handleDeleteLesson = async (lessonId, lessonTitle, courseId) => {
    if (!window.confirm(`Delete the lesson "${lessonTitle}"?`)) return;
    try {
      await deleteLesson(lessonId);
      setCourseLessons((prev) => ({ ...prev, [courseId]: prev[courseId].filter((l) => l._id !== lessonId) }));
      setCourses((prev) =>
        prev.map((c) => (c._id === courseId ? { ...c, lessons: (c.lessons || []).filter((id) => id !== lessonId) } : c))
      );
      flash.success(`Lesson "${lessonTitle}" deleted.`);
    } catch (err) {
      flash.error(toErrorMessage(err));
    }
  };

  const startEditCourse = (e, course) => {
    e.stopPropagation();
    setEditingCourseId(course._id);
    setEditingCourseData({ title: course.title, slug: course.slug });
  };

  const handleSaveCourseEdit = async (e, courseId) => {
    e.stopPropagation();
    try {
      const updated = await updateCourse(courseId, editingCourseData);
      setCourses((prev) => prev.map((c) => (c._id === courseId ? { ...c, ...updated } : c)));
      setEditingCourseId(null);
      flash.success('Course updated.');
    } catch (err) {
      flash.error(toErrorMessage(err));
    }
  };

  /** Throws on failure so the editor can show the message beside its own save button. */
  const handleSaveCourseContent = async (courseId, payload) => {
    try {
      const updated = await updateCourse(courseId, payload);
      setCourses((prev) => prev.map((c) => (c._id === courseId ? { ...c, ...updated } : c)));
      flash.success(`"${updated.title}" updated.`);
      return updated;
    } catch (err) {
      throw new Error(toErrorMessage(err));
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
      flash.success('Lesson updated.');
    } catch (err) {
      flash.error(toErrorMessage(err));
    }
  };

  const enrolledByCourse = new Map(courseStats.map((s) => [String(s.courseId), s.enrolledCount]));
  const totalLessons = courses.reduce((sum, c) => sum + (c.lessons?.length || 0), 0);
  const published = courses.filter((c) => c.published !== false).length;
  const courseOptions = courses.map((course) => (
    <option key={course._id} value={course._id}>
      {course.title}
    </option>
  ));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BookOpen}
        title="Course management"
        description="Create courses, add Drive lessons and study material, and edit what learners see in Browse Courses. Publishing a course notifies learners."
      />

      {flash.node}

      <section className="grid gap-4 sm:grid-cols-3">
        <StatTile featured icon={BookOpen} label="Courses" value={courses.length} hint={`${published} published · ${courses.length - published} draft`} />
        <StatTile icon={Layers} label="Lessons" value={totalLessons} />
        <StatTile icon={BookOpen} tone="green" label="Live enrolments" value={courseStats.reduce((s, c) => s + c.enrolledCount, 0)} />
      </section>

      {/* --- create course / add lesson ------------------------------------ */}
      <section className="grid gap-6 lg:grid-cols-2">
        <Panel icon={Plus} title="Create course">
          <form onSubmit={handleCreateCourse} className="flex flex-col gap-4">
            <Input
              label="Course title"
              required
              placeholder="e.g. Advanced Python Programming"
              value={newCourse.title}
              onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value, slug: slugify(e.target.value) })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="URL slug" required value={newCourse.slug} onChange={(e) => setNewCourse({ ...newCourse, slug: e.target.value })} />
              <Input
                label="Price (₹)"
                type="number"
                min={0}
                placeholder="0 = free"
                value={newCourse.price}
                onChange={(e) => setNewCourse({ ...newCourse, price: e.target.value })}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="new-course-description">Description</label>
              <textarea
                id="new-course-description"
                className="field-input min-h-[90px] resize-y"
                value={newCourse.description}
                onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
              />
            </div>
            <label className="flex items-start gap-2.5 rounded-lg border border-ink-100 p-3 text-[13px] text-ink-700">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-primary-200 text-primary-600"
                checked={newCourse.published}
                onChange={(e) => setNewCourse({ ...newCourse, published: e.target.checked })}
              />
              <span>
                <strong className="font-semibold text-ink-900">Publish now and notify learners</strong>
                <span className="block text-[12px] text-ink-500">Untick to save it as a draft; learners are notified when you publish it later.</span>
              </span>
            </label>
            <Button type="submit" loading={creatingCourse} disabled={creatingCourse} fullWidth>
              Create course
            </Button>
          </form>
        </Panel>

        <Panel icon={LinkIcon} title="Add Drive lesson">
          <form onSubmit={handleAddLesson} className="flex flex-col gap-4">
            <div>
              <label className="field-label" htmlFor="lesson-course">Course</label>
              <select
                id="lesson-course"
                required
                className="field-input"
                value={newLesson.courseId}
                onChange={(e) => setNewLesson({ ...newLesson, courseId: e.target.value })}
              >
                <option value="" disabled>Choose a course…</option>
                {courseOptions}
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
              <label className="field-label" htmlFor="lesson-description">Description</label>
              <textarea
                id="lesson-description"
                className="field-input min-h-[70px] resize-y"
                placeholder="Brief summary of the lesson…"
                value={newLesson.description}
                onChange={(e) => setNewLesson({ ...newLesson, description: e.target.value })}
              />
            </div>
            <Input label="Date" type="date" required value={newLesson.date} onChange={(e) => setNewLesson({ ...newLesson, date: e.target.value })} />
            <Input
              label="Google Drive video link"
              type="url"
              required
              placeholder="https://drive.google.com/file/d/..."
              hint="In Drive, right-click the video → Share → Copy link. Don't copy the address bar while previewing a video — that is the folder's link."
              value={newLesson.driveLink}
              onChange={(e) => setNewLesson({ ...newLesson, driveLink: e.target.value })}
            />
            <Button type="submit" loading={addingLesson} disabled={addingLesson || !newLesson.courseId} fullWidth>
              Import &amp; add lesson
            </Button>
          </form>
        </Panel>
      </section>

      {/* --- study material ----------------------------------------------- */}
      <Panel icon={FileText} title="Add study material">
        <form onSubmit={handleAddResource} className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="resource-course">Course</label>
            <select
              id="resource-course"
              required
              className="field-input"
              value={newResource.courseId}
              onChange={(e) => setNewResource({ ...newResource, courseId: e.target.value })}
            >
              <option value="" disabled>Choose a course…</option>
              {courseOptions}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="resource-type">Type</label>
            <select
              id="resource-type"
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
          <Input label="Title" required placeholder="e.g. Week 1 Handout" value={newResource.title} onChange={(e) => setNewResource({ ...newResource, title: e.target.value })} />
          <div>
            <Input
              label="Link (PDF / Drive / doc URL)"
              type="url"
              required
              placeholder="https://drive.google.com/file/d/..."
              hint={'For Google Drive files, set sharing to "Anyone with the link – Viewer" so learners can open them.'}
              error={newResource.url && !safeExternalUrl(newResource.url) ? 'Use a full link starting with https://' : undefined}
              value={newResource.url}
              onChange={(e) => setNewResource({ ...newResource, url: e.target.value })}
            />
            {safeExternalUrl(newResource.url) && (
              <a
                href={safeExternalUrl(newResource.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-primary-700 hover:text-primary-800"
              >
                <LinkIcon className="h-3.5 w-3.5" aria-hidden="true" />
                Open link to test it
              </a>
            )}
          </div>
          <div className="md:col-span-2">
            <label className="field-label" htmlFor="resource-description">Description (optional)</label>
            <textarea
              id="resource-description"
              className="field-input min-h-[70px] resize-y"
              placeholder="What this resource covers…"
              value={newResource.description}
              onChange={(e) => setNewResource({ ...newResource, description: e.target.value })}
            />
          </div>
          <Button type="submit" loading={addingResource} disabled={addingResource || !newResource.courseId} className="md:col-span-2" fullWidth>
            Add resource
          </Button>
        </form>
      </Panel>

      {/* --- manage courses ----------------------------------------------- */}
      <Panel id="manage-courses" icon={Layers} title="Manage courses & lessons" description="Open a course to edit its content, pricing, publishing, lessons and material." bodyClassName="">
        {loading ? (
          <LoadingRow label="Loading courses…" />
        ) : courses.length === 0 ? (
          <EmptyRow icon={BookOpen} title="No courses yet" description="Create one above." />
        ) : (
          <div className="divide-y divide-ink-100">
            <div className="hidden grid-cols-[1fr_6rem_6rem_6rem_7rem_7rem] gap-4 border-b border-ink-100 bg-ink-50/60 px-6 py-2.5 text-[12px] font-medium text-ink-500 md:grid">
              <span>Course</span>
              <span>Price</span>
              <span>Lessons</span>
              <span>Enrolled</span>
              <span>Status</span>
              <span className="text-right">Actions</span>
            </div>

            {courses.map((course) => {
              const isOpen = expandedCourseId === course._id;
              const isEditing = editingCourseId === course._id;
              return (
                <div key={course._id}>
                  <div
                    className={`flex cursor-pointer flex-col gap-3 px-6 py-4 transition hover:bg-ink-50/60 md:grid md:grid-cols-[1fr_6rem_6rem_6rem_7rem_7rem] md:items-center md:gap-4 ${
                      isOpen ? 'bg-ink-50/60' : ''
                    }`}
                    onClick={() => !editingCourseId && toggleCourseExpansion(course._id)}
                  >
                    <div className="flex items-center gap-3">
                      {isEditing ? (
                        <div className="flex w-full flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            className="admin-field py-1"
                            value={editingCourseData.title}
                            onChange={(e) => setEditingCourseData({ ...editingCourseData, title: e.target.value })}
                            placeholder="Title"
                            aria-label="Course title"
                          />
                          <input
                            type="text"
                            className="admin-field py-1"
                            value={editingCourseData.slug}
                            onChange={(e) => setEditingCourseData({ ...editingCourseData, slug: e.target.value })}
                            placeholder="Slug"
                            aria-label="Course slug"
                          />
                        </div>
                      ) : (
                        <p className="truncate text-sm font-semibold text-ink-900">{course.title}</p>
                      )}
                    </div>

                    <span className="text-sm text-ink-700">{Number(course.price) > 0 ? formatMoney(course.price) : 'Free'}</span>
                    <span className="text-sm text-ink-700">
                      <span className="text-ink-400 md:hidden">Lessons: </span>
                      {course.lessons?.length || 0}
                    </span>
                    <span className="text-sm text-ink-700">
                      <span className="text-ink-400 md:hidden">Enrolled: </span>
                      {enrolledByCourse.get(String(course._id)) || 0}
                    </span>
                    <span>{course.published === false ? <Pill tone="gray">Draft</Pill> : <Pill tone="green">Published</Pill>}</span>

                    <div className="flex items-center gap-1 md:justify-end">
                      {isEditing ? (
                        <>
                          <button onClick={(e) => handleSaveCourseEdit(e, course._id)} className="rounded-lg p-2 text-emerald-600 transition hover:bg-emerald-50" title="Save" aria-label="Save">
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCourseId(null);
                            }}
                            className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-100"
                            title="Cancel"
                            aria-label="Cancel"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={(e) => startEditCourse(e, course)} className="rounded-lg p-2 text-primary-600 transition hover:bg-primary-50" title="Rename" aria-label={`Rename ${course.title}`}>
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCourse(course._id, course.title);
                            }}
                            className="rounded-lg p-2 text-red-500 transition hover:bg-red-50"
                            title="Delete course"
                            aria-label={`Delete ${course.title}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      <span className="text-primary-400">{isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="space-y-5 border-t border-ink-100 bg-ink-50/50 px-6 py-5">
                      {/* Thumbnail, intro video, formatted copy, package,
                          pricing and publishing — what Browse Courses reads. */}
                      <CourseContentEditor course={course} onSave={handleSaveCourseContent} onSaved={fetchCourseStats} />

                      <div>
                        <h4 className="mb-3 text-[13px] font-semibold text-ink-800">Lessons</h4>
                        {loadingLessons[course._id] ? (
                          <p className="flex items-center gap-2 text-sm text-ink-500">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading lessons…
                          </p>
                        ) : courseLessons[course._id]?.length === 0 ? (
                          <p className="text-sm text-ink-500">No lessons added to this course yet.</p>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {courseLessons[course._id]?.map((lesson) => (
                              <div key={lesson._id} className="flex flex-col gap-3 rounded-xl border border-ink-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex flex-1 items-center gap-3">
                                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700">
                                    {lesson.order}
                                  </span>
                                  {editingLessonId === lesson._id ? (
                                    <div className="flex w-full flex-col gap-2">
                                      <div className="flex flex-col gap-2 sm:flex-row">
                                        <input
                                          type="text"
                                          className="admin-field w-full py-1"
                                          value={editingLessonData.title}
                                          onChange={(e) => setEditingLessonData({ ...editingLessonData, title: e.target.value })}
                                          aria-label="Lesson title"
                                        />
                                        <input
                                          type="date"
                                          className="admin-field py-1 sm:w-40"
                                          value={editingLessonData.date}
                                          onChange={(e) => setEditingLessonData({ ...editingLessonData, date: e.target.value })}
                                          aria-label="Lesson date"
                                        />
                                      </div>
                                      <textarea
                                        className="admin-field min-h-[60px] w-full"
                                        value={editingLessonData.description}
                                        onChange={(e) => setEditingLessonData({ ...editingLessonData, description: e.target.value })}
                                        placeholder="Lesson description…"
                                        aria-label="Lesson description"
                                      />
                                    </div>
                                  ) : (
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium text-ink-800">{lesson.title}</p>
                                      {lesson.description && <p className="mt-0.5 truncate text-xs text-ink-500">{lesson.description}</p>}
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 self-end sm:self-auto">
                                  {editingLessonId === lesson._id ? (
                                    <>
                                      <button onClick={() => handleSaveLessonEdit(course._id, lesson._id)} className="rounded-lg p-1.5 text-emerald-600 transition hover:bg-emerald-50" aria-label="Save lesson">
                                        <Save className="h-4 w-4" />
                                      </button>
                                      <button onClick={() => setEditingLessonId(null)} className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100" aria-label="Cancel">
                                        <X className="h-4 w-4" />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button onClick={() => startEditLesson(lesson)} className="rounded-lg p-1.5 text-primary-600 transition hover:bg-primary-50" aria-label={`Edit ${lesson.title}`}>
                                        <Pencil className="h-4 w-4" />
                                      </button>
                                      <button onClick={() => handleDeleteLesson(lesson._id, lesson.title, course._id)} className="rounded-lg p-1.5 text-red-500 transition hover:bg-red-50" aria-label={`Delete ${lesson.title}`}>
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
                        <h4 className="mb-3 text-[13px] font-semibold text-ink-800">Study materials</h4>
                        {loadingResources[course._id] ? (
                          <p className="flex items-center gap-2 text-sm text-ink-500">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading resources…
                          </p>
                        ) : courseResources[course._id]?.length === 0 ? (
                          <p className="text-sm text-ink-500">No study materials added to this course yet.</p>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {courseResources[course._id]?.map((resource) => (
                              <div key={resource.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 bg-white p-3">
                                <div className="flex min-w-0 items-center gap-3">
                                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary-600">
                                    <FileText className="h-4 w-4" />
                                  </span>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-ink-800">{resource.title}</p>
                                    <a href={safeExternalUrl(resource.url) || undefined} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-primary-600 hover:underline">
                                      {resource.url}
                                    </a>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleDeleteResource(resource.id, resource.title, course._id)}
                                  className="shrink-0 rounded-lg p-1.5 text-red-500 transition hover:bg-red-50"
                                  aria-label={`Delete ${resource.title}`}
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
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
