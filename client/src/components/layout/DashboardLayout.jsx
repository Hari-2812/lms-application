import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar from './Sidebar.jsx';
import DashboardHeader from './DashboardHeader.jsx';

/**
 * Lets a page set the text shown in the dashboard header without lifting the
 * whole header into every page.
 */
const PageMetaContext = createContext(null);

export function usePageMeta(title, subtitle) {
  const setMeta = useContext(PageMetaContext);
  useEffect(() => {
    if (!setMeta) return undefined;
    setMeta({ title, subtitle });
    return () => setMeta({});
  }, [setMeta, title, subtitle]);
}

/**
 * True when a page is rendering inside the dashboard shell. Pages that appear
 * in both the public and authenticated layouts use it to avoid emitting a
 * second <h1>, since the dashboard header already provides the page's.
 */
export function useIsDashboard() {
  return useContext(PageMetaContext) !== null;
}

/** Shell for every authenticated page: fixed sidebar + sticky header. */
export default function DashboardLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [meta, setMeta] = useState({});
  const location = useLocation();

  useEffect(() => setDrawerOpen(false), [location.pathname]);

  const setMetaStable = useMemo(() => (next) => setMeta(next || {}), []);

  return (
    <PageMetaContext.Provider value={setMetaStable}>
      <div className="flex min-h-screen bg-surface-muted">
        <a
          href="#dashboard-main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50
                     focus:rounded-lg focus:bg-primary-600 focus:px-4 focus:py-2 focus:text-sm
                     focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>

        <Sidebar isMobileOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

        <div className="flex min-w-0 flex-1 flex-col">
          <DashboardHeader
            title={meta.title}
            subtitle={meta.subtitle}
            onMenuClick={() => setDrawerOpen(true)}
          />

          <motion.main
            id="dashboard-main"
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
          >
            <div className="mx-auto max-w-6xl">
              <Outlet />
            </div>
          </motion.main>
        </div>
      </div>
    </PageMetaContext.Provider>
  );
}
