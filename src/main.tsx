import '@/lib/errorReporter';
import { enableMapSet } from "immer";
enableMapSet();
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  createBrowserRouter,
  RouterProvider
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import MyBookingsPage from '@/pages/MyBookingsPage';
import '@/index.css'
import LandingPage from '@/pages/LandingPage'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import AdminPage from '@/pages/AdminPage'
import { AuthProvider } from '@/lib/mock-auth'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

const queryClient = new QueryClient();

const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/login",
    element: <LoginPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute requiredRole="USER">
        <DashboardPage />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/bookings",
    element: (
      <ProtectedRoute requiredRole="USER">
        <MyBookingsPage />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/admin",
    element: (
      <ProtectedRoute requiredRole="ADMIN">
        <AdminPage />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  }
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  </StrictMode>,
)