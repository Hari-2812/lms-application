import { Suspense, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import AdminSidebar from './AdminSidebar.jsx';
import DashboardHeader from '../../layout/DashboardHeader.jsx';
import { PageMetaContext, usePageMeta } from '../../layout/DashboardLayout.jsx';
import { useAuth } from '../../../context/AuthContext.jsx';
import { EmptyRow, LoadingRow } from '../ui.jsx';

/**
 * Shell for every /admin page: blue sidebar, the shared top bar (bell,
 * account menu) and a blue-tinted canvas. Provides the same PageMeta
 * context as the learner dashboard, so usePageMeta works in admin pages.
 */
export default function AdminLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [meta, setMeta] = useState({});
  const location = useLocation();

  useEffect(() => setDrawerOpen(false), [location.pathname]);
  const setMetaStable = useMemo(() => (next) => setMeta(next || {}), []);

  return (
    <PageMetaContext.Provider value={setMetaStable}>
      <div className="flex min-h-screen bg-surface-muted">
        <a
          href="#admin-main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50
                     focus:rounded-lg focus:bg-primary-600 focus:px-4 focus:py-2 focus:text-sm
                     focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>

        <AdminSidebar isMobileOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

        <div className="flex min-w-0 flex-1 flex-col">
          <DashboardHeader
            variant="admin"
            title={meta.title}
            subtitle={meta.subtitle}
            onMenuClick={() => setDrawerOpen(true)}
          />

          <motion.main
            id="admin-main"
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
          >
            <div className="mx-auto max-w-7xl">
              {/* Admin pages are lazy; keep the shell on screen while one loads. */}
              <Suspense fallback={<div className="admin-card"><LoadingRow /></div>}>
                <Outlet />
              </Suspense>
            </div>
          </motion.main>
        </div>
      </div>
    </PageMetaContext.Provider>
  );
}

/** Wraps a Super-Admin-only page; Support / Reviewer accounts see why it is closed. */
export function SuperAdminOnly({ children }) {
  const { isSuperAdmin } = useAuth();
  if (isSuperAdmin) return children;
  return <Restricted />;
}

function Restricted() {
  usePageMeta('Super Admin only', 'Your role does not include this page.');
  return (
    <div className="admin-card">
      <EmptyRow
        icon={Lock}
        title="Super Admin only"
        description="Your Support / Reviewer role can view learners and payments, review tasks, see certificates and send notifications. Ask a Super Admin for anything else."
      />
    </div>
  );
}
