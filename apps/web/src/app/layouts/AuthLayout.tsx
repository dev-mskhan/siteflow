import { Outlet } from 'react-router-dom';

/**
 * Unauthenticated layout.
 * Wraps login/register/forgot-password routes with a centred card shell.
 */
export function AuthLayout() {
  return (
    <div className="auth-layout">
      <Outlet />
    </div>
  );
}
