import '@/lib/errorReporter';
import { enableMapSet } from "immer";
import { Toaster } from "sonner";
enableMapSet();
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  createBrowserRouter,
  RouterProvider
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import MyBookingsPage from '@/pages/MyBookingsPage';
import '@/index.css'
import LandingPage from '@/pages/LandingPage'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import VenuePage from '@/pages/VenuePage'
import AdminPage from '@/pages/AdminPage'
import AdminUsersPage from '@/pages/AdminUsersPage'
import AdminSettingsPage from '@/pages/AdminSettingsPage'
import VenueManagementPage from '@/pages/VenueManagementPage'
import BookingHistoryPage from '@/pages/BookingHistoryPage'
import SchedulePage from '@/pages/SchedulePage'
import { AuthProvider } from '@/lib/mock-auth'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { useGoogleOAuthConfig } from '@/lib/google-oauth'

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
      <ProtectedRoute requiredRole="USER" disallowAdmin>
        <DashboardPage />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/schedule",
    element: (
      <ProtectedRoute requiredRole="USER">
        <SchedulePage />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/venues",
    element: (
      <ProtectedRoute requiredRole="USER">
        <VenuePage />
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
  },
  {
    path: "/admin/venues",
    element: (
      <ProtectedRoute requiredRole="ADMIN">
        <VenueManagementPage />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/admin/users",
    element: (
      <ProtectedRoute requiredRole="ADMIN">
        <AdminUsersPage />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/admin/settings",
    element: (
      <ProtectedRoute requiredRole="ADMIN">
        <AdminSettingsPage />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/admin/history",
    element: (
      <ProtectedRoute requiredRole="ADMIN">
        <BookingHistoryPage />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  }
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppRoot />
    </QueryClientProvider>
  </StrictMode>,
)

function AppRoot() {
  const { googleClientId, isGoogleOAuthEnabled } = useGoogleOAuthConfig();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js');
      } catch (error) {
        console.error('Service worker registration failed:', error);
      }
    };

    register();
  }, []);

  const app = (
    <ErrorBoundary>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster richColors position="top-center" />
      </AuthProvider>
    </ErrorBoundary>
  );

  if (!isGoogleOAuthEnabled) {
    return app;
  }

  return <GoogleOAuthProvider clientId={googleClientId}>{app}</GoogleOAuthProvider>;
}
