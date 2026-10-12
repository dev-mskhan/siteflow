/**
 * useAuth — derived session hook
 *
 * Reads authenticated user from RTK Query cache (useGetMeQuery).
 * Exposes login/logout/register mutations.
 *
 * This hook is the single auth interface for the app.
 * Do NOT import useGetMeQuery directly in components — use this.
 */

import { useNavigate, useLocation } from 'react-router-dom';
import { useGetMeQuery, useLoginMutation, useRegisterMutation, useLogoutMutation } from '../api/authApi';
import type { LoginInput, RegisterInput } from '@siteflow/shared';

export function useAuth() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    data: user,
    isLoading,
    isFetching,
    isError,
  } = useGetMeQuery();

  const [loginMutation, { isLoading: isLoggingIn, error: loginError }] = useLoginMutation();
  const [registerMutation, { isLoading: isRegistering, error: registerError }] = useRegisterMutation();
  const [logoutMutation, { isLoading: isLoggingOut }] = useLogoutMutation();

  const login = async (credentials: LoginInput) => {
    const user = await loginMutation(credentials).unwrap();
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/projects';
    navigate(from, { replace: true });
    return user;
  };

  const register = async (data: RegisterInput) => {
    const user = await registerMutation(data).unwrap();
    return user;
  };

  const logout = async () => {
    try {
      await logoutMutation().unwrap();
    } catch {
      // Ignore network errors on logout
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return {
    user: user ?? null,
    isLoading: isLoading || isFetching,
    isAuthenticated: !!user && !isError,
    isLoggingIn,
    isRegistering,
    isLoggingOut,
    loginError,
    registerError,
    login,
    register,
    logout,
  };
}
