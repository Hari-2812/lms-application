import axios from 'axios';

/**
 * Where the Express API lives.
 *
 * Empty in development and in any single-origin deployment: requests go to
 * our own origin (/api/...), which the Vite dev server proxies to Express.
 *
 * On a split deploy (static frontend on Vercel, Node backend elsewhere) set
 * VITE_API_URL to the backend origin, e.g. https://lms-demo-api.onrender.com
 * — no trailing slash. The backend must then list the frontend origin in
 * CLIENT_URL so CORS allows it.
 *
 * Either way the client has no Google credentials and no knowledge of Drive.
 */
const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export { API_ORIGIN };

export const api = axios.create({ baseURL: `${API_ORIGIN}/api` });

/**
 * If a session token is present it is sent on every request. The current
 * backend uses mock auth and ignores it; a real backend can start verifying
 * this header without any frontend change.
 */
export function setAuthToken(token) {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
}

export const getMe = () => api.get('/me').then((r) => r.data);
export const getHealth = () => api.get('/health').then((r) => r.data);

// --- auth -----------------------------------------------------------------
// Integration points for a real auth backend. Until /api/auth/* exists these
// reject with a 404 and AuthContext falls back to the demo session — see
// context/AuthContext.jsx.
export const login = (credentials) => api.post('/auth/login', credentials).then((r) => r.data);
export const register = (payload) => api.post('/auth/register', payload).then((r) => r.data);
export const logout = () => api.post('/auth/logout').then((r) => r.data);

// --- courses --------------------------------------------------------------
export const getCourses = () =>
  api.get('/courses').then((r) => {
    if (!Array.isArray(r.data)) {
      throw new Error('The course API returned an invalid response. Check VITE_API_URL.');
    }
    return r.data;
  });
export const getCourse = (courseId) => api.get(`/courses/${courseId}`).then((r) => r.data);
export const getCourseLessons = (courseId) =>
  api.get(`/courses/${courseId}/lessons`).then((r) => r.data);
export const getLesson = (lessonId) => api.get(`/lessons/${lessonId}`).then((r) => r.data);
export const getCourseResources = (courseId) =>
  api.get(`/courses/${courseId}/resources`).then((r) => r.data);

// --- admin ----------------------------------------------------------------
export const createCourse = (payload) => api.post('/admin/courses', payload).then((r) => r.data);
export const updateCourse = (courseId, payload) => api.put(`/admin/courses/${courseId}`, payload).then((r) => r.data);
export const deleteCourse = (courseId) => api.delete(`/admin/courses/${courseId}`).then((r) => r.data);
export const addLesson = (payload) => api.post('/admin/lessons', payload).then((r) => r.data);
export const updateLesson = (lessonId, payload) => api.put(`/admin/lessons/${lessonId}`, payload).then((r) => r.data);
export const deleteLesson = (lessonId) => api.delete(`/admin/lessons/${lessonId}`).then((r) => r.data);

// --- admin: overview stats ---------------------------------------------------
export const getCourseStats = () => api.get('/admin/courses/stats').then((r) => r.data);

// --- admin: per-student course access --------------------------------------
export const getStudents = () => api.get('/admin/students').then((r) => r.data);
export const getStudentAccess = (studentId) =>
  api.get(`/admin/students/${studentId}/access`).then((r) => r.data);
export const grantAccess = (studentId, courseId) =>
  api.post('/admin/access', { studentId, courseId }).then((r) => r.data);
export const revokeAccess = (studentId, courseId) =>
  api.delete('/admin/access', { data: { studentId, courseId } }).then((r) => r.data);
export const bulkGrantAccess = (studentIds, courseId) =>
  api.post('/admin/access/bulk', { studentIds, courseId }).then((r) => r.data);
export const broadcastNotification = (payload) =>
  api.post('/admin/notifications', payload).then((r) => r.data);

// --- admin: resources -------------------------------------------------------
export const addResource = (payload) => api.post('/admin/resources', payload).then((r) => r.data);
export const updateResource = (resourceId, payload) =>
  api.put(`/admin/resources/${resourceId}`, payload).then((r) => r.data);
export const deleteResource = (resourceId) =>
  api.delete(`/admin/resources/${resourceId}`).then((r) => r.data);

// --- notifications ----------------------------------------------------------
export const getNotifications = (cursor) =>
  api.get('/notifications', { params: cursor ? { cursor } : undefined }).then((r) => r.data);
export const markNotificationRead = (id) => api.patch(`/notifications/${id}/read`).then((r) => r.data);
export const markAllNotificationsRead = () => api.patch('/notifications/read-all').then((r) => r.data);

// --- progress -------------------------------------------------------------
export const getProgress = (lessonId) => api.get(`/progress/${lessonId}`).then((r) => r.data);
export const saveProgress = (payload) => api.post('/progress', payload).then((r) => r.data);

/**
 * The video element's src. Always our own API — never a drive.google.com URL.
 * Relative when API_ORIGIN is empty, absolute on a split deploy.
 */
export const streamUrl = (lessonId) => {
  let token = '';
  try {
    const session = JSON.parse(localStorage.getItem('lms.session'));
    if (session && session.token) token = session.token;
  } catch (e) {
    // ignore
  }
  const qs = token ? `?token=${token}` : '';
  return `${API_ORIGIN}/api/videos/${lessonId}/stream${qs}`;
};

/** Normalises an axios failure into a message we can show a student. */
export function toErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  const responseError = err?.response?.data?.error;
  if (typeof responseError === 'string') return responseError;
  if (responseError && typeof responseError.message === 'string') return responseError.message;
  if (typeof err?.message === 'string') return err.message;
  return fallback;
}
