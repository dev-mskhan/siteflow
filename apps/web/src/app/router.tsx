import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';

// TODO: Import route page components as features are built out
export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', lazy: () => import('../routes/auth/LoginPage') },
      { path: '/register', lazy: () => import('../routes/auth/RegisterPage') },
    ],
  },
  {
    element: <AppLayout />,
    children: [
      { path: '/', lazy: () => import('../routes/dashboard') },
      { path: '/projects/*', lazy: () => import('../routes/projects') },
      { path: '/settings/*', lazy: () => import('../routes/settings') },
    ],
  },
]);
