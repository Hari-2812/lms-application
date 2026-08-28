import { Outlet } from 'react-router-dom';
import PublicNavbar from './PublicNavbar.jsx';
import PublicFooter from './PublicFooter.jsx';

/** Shell for everything a signed-out visitor can see. */
export default function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50
                   focus:rounded-lg focus:bg-primary-600 focus:px-4 focus:py-2 focus:text-sm
                   focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <PublicNavbar />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}
