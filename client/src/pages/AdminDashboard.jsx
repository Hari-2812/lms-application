import { useState, useEffect } from 'react';
import { getCourses, createCourse, addLesson, deleteCourse, deleteLesson, updateCourse, updateLesson, getCourseLessons, toErrorMessage } from '../api/client';
import { Loader2, Plus, Link as LinkIcon, BookOpen, AlertCircle, CheckCircle2, Trash2, ChevronDown, ChevronUp, Pencil, X, Save } from 'lucide-react';

export default function AdminDashboard() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  // List State
  const [expandedCourseId, setExpandedCourseId] = useState(null);
  const [courseLessons, setCourseLessons] = useState({});
  const [loadingLessons, setLoadingLessons] = useState({});

  // Edit State
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [editingCourseData, setEditingCourseData] = useState(null);
  const [editingLessonId, setEditingLessonId] = useState(null);
  const [editingLessonData, setEditingLessonData] = useState(null);

  useEffect(() => {
    fetchCourses();
  }, []);

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

  const toggleCourseExpansion = async (courseId) => {
    if (expandedCourseId === courseId) {
      setExpandedCourseId(null);
      return;
    }
    setExpandedCourseId(courseId);
    
    // Fetch lessons if not already loaded
    if (!courseLessons[courseId]) {
      setLoadingLessons(prev => ({ ...prev, [courseId]: true }));
      try {
        const lessons = await getCourseLessons(courseId);
        setCourseLessons(prev => ({ ...prev, [courseId]: lessons }));
      } catch (err) {
        setError(toErrorMessage(err));
      } finally {
        setLoadingLessons(prev => ({ ...prev, [courseId]: false }));
      }
    }
  };

  const handleDeleteCourse = async (courseId, courseTitle) => {
    if (!window.confirm(`Are you sure you want to delete the course "${courseTitle}" and ALL its lessons?`)) return;
    
    try {
      await deleteCourse(courseId);
      setCourses(courses.filter(c => c._id !== courseId));
      setSuccess(`Course "${courseTitle}" deleted successfully`);
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  const handleDeleteLesson = async (lessonId, lessonTitle, courseId) => {
    if (!window.confirm(`Are you sure you want to delete the lesson "${lessonTitle}"?`)) return;
    
    try {
      await deleteLesson(lessonId);
      // Update local state
      setCourseLessons(prev => ({
        ...prev,
        [courseId]: prev[courseId].filter(l => l._id !== lessonId)
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
      setCourses(courses.map(c => c._id === courseId ? { ...c, ...updated } : c));
      setEditingCourseId(null);
      setSuccess('Course updated successfully');
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  const startEditLesson = (lesson) => {
    setEditingLessonId(lesson._id);
    setEditingLessonData({ 
      title: lesson.title, 
      description: lesson.description || '', 
      date: lesson.date ? lesson.date.split('T')[0] : '' 
    });
  };

  const handleSaveLessonEdit = async (courseId, lessonId) => {
    try {
      const updated = await updateLesson(lessonId, editingLessonData);
      setCourseLessons(prev => ({
        ...prev,
        [courseId]: prev[courseId].map(l => l._id === lessonId ? { ...l, ...updated } : l)
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 relative">
      {/* Decorative background elements */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] h-[50%] w-[50%] rounded-full bg-primary-400/10 blur-[100px]"></div>
        <div className="absolute top-[40%] -right-[10%] h-[50%] w-[50%] rounded-full bg-purple-400/10 blur-[120px]"></div>
      </div>

      <header className="mb-10 text-center sm:text-left">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
          Admin <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-purple-600">Dashboard</span>
        </h1>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
          Manage your curriculum and seamlessly import videos from Google Drive.
        </p>
      </header>

      {error && (
        <div className="mb-8 flex items-center gap-3 rounded-2xl bg-red-50/80 p-4 text-red-800 border border-red-200/50 backdrop-blur-sm dark:bg-red-500/10 dark:text-red-200 dark:border-red-500/20 shadow-sm animate-in fade-in slide-in-from-top-4">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-8 flex items-center gap-3 rounded-2xl bg-emerald-50/80 p-4 text-emerald-800 border border-emerald-200/50 backdrop-blur-sm dark:bg-emerald-500/10 dark:text-emerald-200 dark:border-emerald-500/20 shadow-sm animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">{success}</p>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Course Creation Card */}
        <section className="relative overflow-hidden rounded-3xl border border-white/20 bg-white/60 p-8 shadow-xl backdrop-blur-xl dark:border-slate-800/50 dark:bg-slate-900/60">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <BookOpen className="h-24 w-24" />
          </div>
          
          <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <Plus className="h-6 w-6 text-primary-500" />
            Create Course
          </h2>
          
          <form onSubmit={handleCreateCourse} className="relative z-10 flex flex-col gap-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Course Title</label>
              <input
                required
                type="text"
                className="w-full rounded-xl border-slate-300 bg-white/50 px-4 py-2.5 text-sm transition-all focus:border-primary-500 focus:bg-white focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white dark:focus:bg-slate-800"
                placeholder="e.g. Advanced Python Programming"
                value={newCourse.title}
                onChange={(e) => {
                  const title = e.target.value;
                  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
                  setNewCourse({ ...newCourse, title, slug });
                }}
              />
            </div>
            
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">URL Slug</label>
              <input
                required
                type="text"
                className="w-full rounded-xl border-slate-300 bg-white/50 px-4 py-2.5 text-sm transition-all focus:border-primary-500 focus:bg-white focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white dark:focus:bg-slate-800"
                value={newCourse.slug}
                onChange={(e) => setNewCourse({ ...newCourse, slug: e.target.value })}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
              <textarea
                className="w-full rounded-xl border-slate-300 bg-white/50 px-4 py-2.5 text-sm transition-all focus:border-primary-500 focus:bg-white focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white dark:focus:bg-slate-800 min-h-[100px]"
                value={newCourse.description}
                onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={creatingCourse}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-500/30 transition-all hover:opacity-90 hover:shadow-primary-500/40 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 dark:focus:ring-offset-slate-900"
            >
              {creatingCourse ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Create Course'}
            </button>
          </form>
        </section>

        {/* Lesson Creation Card */}
        <section className="relative overflow-hidden rounded-3xl border border-white/20 bg-white/60 p-8 shadow-xl backdrop-blur-xl dark:border-slate-800/50 dark:bg-slate-900/60">
           <div className="absolute top-0 right-0 p-6 opacity-10">
            <LinkIcon className="h-24 w-24" />
          </div>

          <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <LinkIcon className="h-6 w-6 text-purple-500" />
            Add Drive Lesson
          </h2>

          <form onSubmit={handleAddLesson} className="relative z-10 flex flex-col gap-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Select Course</label>
              <select
                required
                className="w-full rounded-xl border-slate-300 bg-white/50 px-4 py-2.5 text-sm transition-all focus:border-purple-500 focus:bg-white focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white dark:focus:bg-slate-800"
                value={newLesson.courseId}
                onChange={(e) => setNewLesson({ ...newLesson, courseId: e.target.value })}
              >
                <option value="" disabled>Choose a course...</option>
                {courses.map(course => (
                  <option key={course._id} value={course._id}>{course.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Lesson Title</label>
              <input
                required
                type="text"
                placeholder="e.g. 1. Introduction to Variables"
                className="w-full rounded-xl border-slate-300 bg-white/50 px-4 py-2.5 text-sm transition-all focus:border-purple-500 focus:bg-white focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white dark:focus:bg-slate-800"
                value={newLesson.title}
                onChange={(e) => setNewLesson({ ...newLesson, title: e.target.value })}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
              <textarea
                placeholder="Brief summary of the lesson..."
                className="w-full rounded-xl border-slate-300 bg-white/50 px-4 py-2.5 text-sm transition-all focus:border-purple-500 focus:bg-white focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white dark:focus:bg-slate-800 min-h-[80px]"
                value={newLesson.description}
                onChange={(e) => setNewLesson({ ...newLesson, description: e.target.value })}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Date</label>
              <input
                required
                type="date"
                className="w-full rounded-xl border-slate-300 bg-white/50 px-4 py-2.5 text-sm transition-all focus:border-purple-500 focus:bg-white focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white dark:focus:bg-slate-800"
                value={newLesson.date}
                onChange={(e) => setNewLesson({ ...newLesson, date: e.target.value })}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Google Drive Video Link</label>
              <input
                required
                type="url"
                placeholder="https://drive.google.com/file/d/..."
                className="w-full rounded-xl border-slate-300 bg-white/50 px-4 py-2.5 text-sm transition-all focus:border-purple-500 focus:bg-white focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white dark:focus:bg-slate-800 font-mono text-xs"
                value={newLesson.driveLink}
                onChange={(e) => setNewLesson({ ...newLesson, driveLink: e.target.value })}
              />
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                The file must be shared with your service account. The server will extract the ID and securely proxy the stream.
              </p>
            </div>

            <button
              type="submit"
              disabled={addingLesson || !newLesson.courseId}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition-all hover:opacity-90 hover:shadow-purple-500/40 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 dark:focus:ring-offset-slate-900"
            >
              {addingLesson ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Import & Add Lesson'}
            </button>
          </form>
        </section>
      </div>

      {/* Course Management List */}
      <section className="mt-12">
        <h2 className="mb-6 text-2xl font-bold text-slate-900 dark:text-white">
          Manage Courses & Lessons
        </h2>
        
        {courses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No courses available yet. Create one above!
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {courses.map(course => (
              <div key={course._id} className="overflow-hidden rounded-2xl border border-white/20 bg-white/60 shadow-md backdrop-blur-xl transition-all dark:border-slate-800/50 dark:bg-slate-900/60">
                <div 
                  className="flex cursor-pointer flex-col md:flex-row items-start md:items-center justify-between p-5 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 gap-4"
                  onClick={() => !editingCourseId && toggleCourseExpansion(course._id)}
                >
                  <div className="flex items-center gap-4 w-full md:w-auto flex-1">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    {editingCourseId === course._id ? (
                      <div className="flex w-full flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          className="w-full rounded-md border-slate-300 bg-white px-3 py-1 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          value={editingCourseData.title}
                          onChange={(e) => setEditingCourseData({ ...editingCourseData, title: e.target.value })}
                          placeholder="Title"
                        />
                        <input
                          type="text"
                          className="w-full rounded-md border-slate-300 bg-white px-3 py-1 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          value={editingCourseData.slug}
                          onChange={(e) => setEditingCourseData({ ...editingCourseData, slug: e.target.value })}
                          placeholder="Slug"
                        />
                      </div>
                    ) : (
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">{course.title}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{course.lessons?.length || 0} lessons</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    {editingCourseId === course._id ? (
                      <>
                        <button
                          onClick={(e) => handleSaveCourseEdit(e, course._id)}
                          className="rounded-lg p-2 text-emerald-600 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-500/10 dark:text-emerald-400"
                          title="Save"
                        >
                          <Save className="h-5 w-5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingCourseId(null); }}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Cancel"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={(e) => startEditCourse(e, course)}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-primary-50 hover:text-primary-600 dark:hover:bg-primary-500/10 dark:hover:text-primary-400"
                          title="Edit Course"
                        >
                          <Pencil className="h-5 w-5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteCourse(course._id, course.title); }}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                          title="Delete Course"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </>
                    )}
                    <div className="ml-1 text-slate-400">
                      {expandedCourseId === course._id ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                  </div>
                </div>

                {/* Lessons Dropdown */}
                {expandedCourseId === course._id && (
                  <div className="border-t border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-900/40">
                    {loadingLessons[course._id] ? (
                      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading lessons...
                      </div>
                    ) : courseLessons[course._id]?.length === 0 ? (
                      <div className="text-sm text-slate-500 dark:text-slate-400">No lessons added to this course yet.</div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {courseLessons[course._id]?.map(lesson => (
                          <div key={lesson._id} className="flex flex-col md:flex-row md:items-center justify-between rounded-xl bg-white p-3 shadow-sm dark:bg-slate-800 gap-3">
                            <div className="flex items-center gap-3 flex-1">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                {lesson.order}
                              </span>
                              
                              {editingLessonId === lesson._id ? (
                                <div className="flex w-full flex-col gap-2">
                                  <div className="flex flex-col md:flex-row gap-2">
                                    <input
                                      type="text"
                                      className="w-full rounded-md border-slate-300 bg-slate-50 px-3 py-1 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                      value={editingLessonData.title}
                                      onChange={(e) => setEditingLessonData({ ...editingLessonData, title: e.target.value })}
                                      placeholder="Title"
                                    />
                                    <input
                                      type="date"
                                      className="w-full md:w-32 rounded-md border-slate-300 bg-slate-50 px-3 py-1 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                      value={editingLessonData.date}
                                      onChange={(e) => setEditingLessonData({ ...editingLessonData, date: e.target.value })}
                                    />
                                  </div>
                                  <textarea
                                    className="w-full rounded-md border-slate-300 bg-slate-50 px-3 py-1 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white min-h-[60px]"
                                    value={editingLessonData.description}
                                    onChange={(e) => setEditingLessonData({ ...editingLessonData, description: e.target.value })}
                                    placeholder="Lesson description..."
                                  />
                                </div>
                              ) : (
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{lesson.title}</span>
                                  {lesson.description && (
                                    <span className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{lesson.description}</span>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2 ml-9 md:ml-0 shrink-0">
                              {editingLessonId === lesson._id ? (
                                <>
                                  <button
                                    onClick={() => handleSaveLessonEdit(course._id, lesson._id)}
                                    className="rounded-lg p-1.5 text-emerald-600 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-500/10 dark:text-emerald-400"
                                    title="Save"
                                  >
                                    <Save className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => setEditingLessonId(null)}
                                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                                    title="Cancel"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => startEditLesson(lesson)}
                                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-500/10 dark:hover:text-purple-400"
                                    title="Edit Lesson"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteLesson(lesson._id, lesson.title, course._id)}
                                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                                    title="Delete Lesson"
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
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
