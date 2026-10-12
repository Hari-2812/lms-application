import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import PublicLayout from './components/layout/PublicLayout.jsx';
import DashboardLayout, { useIsDashboard } from './components/layout/DashboardLayout.jsx';
import LearnLayout from './components/layout/LearnLayout.jsx';
import ProtectedRoute from './components/layout/ProtectedRoute.jsx';
import AdminRoute from './components/layout/AdminRoute.jsx';
import { useAuth } from './context/AuthContext.jsx';

import Home from './pages/Home.jsx';
import Courses from './pages/Courses.jsx';
import CourseDetails from './pages/CourseDetails.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import NotFound from './pages/NotFound.jsx';

// The authenticated bundle is only fetched once a student signs in.
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const MyCourses = lazy(() => import('./pages/MyCourses.jsx'));
const Resources = lazy(() => import('./pages/Resources.jsx'));
const CourseLearning = lazy(() => import('./pages/CourseLearning.jsx'));
const ProgressPage = lazy(() => import('./pages/ProgressPage.jsx'));
const Certificates = lazy(() => import('./pages/Certificates.jsx'));
const Wishlist = lazy(() => import('./pages/Wishlist.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));
const HowItWorksPage = lazy(() => import('./pages/HowItWorksPage.jsx'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx'));
const Checkout = lazy(() => import('./pages/Checkout.jsx'));
const Events = lazy(() => import('./pages/Events.jsx'));
const TaskSubmission = lazy(() => import('./pages/TaskSubmission.jsx'));
const Notifications = lazy(() => import('./pages/Notifications.jsx'));

function RouteFallback() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary-600" aria-label="Loading" />
    </div>
  );
}

/** Public course pages need the page padding the dashboard shell provides. */
function PublicPage({ children }) {
  return <div className="container py-8 lg:py-10">{children}</div>;
}

/**
 * The course catalogue and course details are meant to be browsable by
 * anyone, but a signed-in student should never be bounced out of their
 * dashboard shell into the marketing site just to look at a course — so this
 * picks whichever shell matches who's looking, and the pages below use
 * `useIsDashboard()` to avoid double-applying page padding.
 */
function CatalogueShell() {
  const { isAuthenticated, initialising } = useAuth();
  if (initialising) return <RouteFallback />;
  return isAuthenticated ? <DashboardLayout /> : <PublicLayout />;
}

function CourseDetailsPage() {
  const inDashboard = useIsDashboard();
  const content = <CourseDetails />;
  return inDashboard ? content : <PublicPage>{content}</PublicPage>;
}

/** Keeps the previous /course/:courseId URLs working. */
function LegacyCourseRedirect() {
  const { courseId } = useParams();
  return <Navigate to={`/my-courses/${courseId}`} replace />;
}

function LegacyLessonRedirect() {
  const { courseId, lessonId } = useParams();
  return <Navigate to={`/learn/${courseId}/${lessonId}`} replace />;
}

/** Jump to the top on navigation, but leave in-page #anchors alone. */
function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    // 'instant' overrides the smooth scrolling used by in-page anchor links.
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname, hash]);

  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* ---------- Public ---------- */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          {/* ---------- Course catalogue: shell follows sign-in state ---------- */}
          <Route element={<CatalogueShell />}>
            <Route path="/courses" element={<Courses />} />
            <Route path="/courses/:courseId" element={<CourseDetailsPage />} />
          </Route>

          {/* ---------- Auth ---------- */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* ---------- Authenticated ---------- */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/my-courses" element={<MyCourses />} />
              <Route path="/my-courses/:courseId" element={<CourseDetails />} />
              <Route path="/resources" element={<Resources />} />
              <Route path="/progress" element={<ProgressPage />} />
              <Route path="/certificates" element={<Certificates />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/events" element={<Events />} />
              <Route path="/tasks" element={<TaskSubmission />} />
              {/* Checkout lives under /courses so it reads as a step in the
                  catalogue flow, but it needs a signed-in student. */}
              <Route path="/courses/:courseId/enrol" element={<Checkout />} />
              <Route path="/wishlist" element={<Wishlist />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/how-it-works" element={<HowItWorksPage />} />
              <Route path="/admin" element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              } />
            </Route>

            {/* The player gets its own full-width shell. */}
            <Route element={<LearnLayout />}>
              <Route path="/learn/:courseId/:lessonId" element={<CourseLearning />} />
            </Route>
          </Route>

          {/* ---------- Legacy URLs ---------- */}
          <Route path="/course/:courseId" element={<LegacyCourseRedirect />} />
          <Route path="/course/:courseId/lesson/:lessonId" element={<LegacyLessonRedirect />} />
        </Routes>
      </Suspense>
    </>
  );
}
