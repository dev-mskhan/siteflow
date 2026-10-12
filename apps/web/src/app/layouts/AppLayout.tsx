import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from '../../components/navigation/Sidebar';
import { Topbar } from '../../components/navigation/Topbar';
import { useGetMeQuery } from '../../features/auth/api/authApi';
import { LoadingSpinner } from '../../components/ui/Skeleton';

export function AppLayout() {
  const location = useLocation();
  const { data: user, isLoading, isError } = useGetMeQuery();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-text" style={{ backgroundColor: 'var(--bg)' }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Redirect to login if unauthenticated
  if (isError || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <div className="min-h-screen flex bg-bg text-text" style={{ backgroundColor: 'var(--bg)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
