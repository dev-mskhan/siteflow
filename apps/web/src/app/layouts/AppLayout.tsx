import { Outlet } from 'react-router-dom';

/**
 * Authenticated app shell.
 * Wraps all protected routes with Sidebar, Topbar, and Breadcrumbs.
 */
export function AppLayout() {
  return (
    <div className="app-layout">
      {/* <Sidebar /> */}
      {/* <Topbar /> */}
      <main className="app-layout__content">
        <Outlet />
      </main>
    </div>
  );
}
