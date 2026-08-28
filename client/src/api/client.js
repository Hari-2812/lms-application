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

// --- progress -------------------------------------------------------------
export const getProgress = (lessonId) => api.get(`/progress/${lessonId}`).then((r) => r.data);
export const saveProgress = (payload) => api.post('/progress', payload).then((r) => r.data);

/**
 * The video element's src. Always our own API — never a drive.google.com URL.
 * Relative when API_ORIGIN is empty, absolute on a split deploy.
 */
export const streamUrl = (lessonId) => `${API_ORIGIN}/api/videos/${lessonId}/stream`;

/** Normalises an axios failure into a message we can show a student. */
export function toErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  return err?.response?.data?.error || err?.message || fallback;
}
