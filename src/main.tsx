import '@/lib/errorReporter';
import { enableMapSet } from "immer";
import { Toaster } from "sonner";
enableMapSet();
import { StrictMode, Suspense, lazy, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import {
  createBrowserRouter,
  RouterProvider
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import '@/index.css'
import { AuthProvider } from '@/lib/mock-auth'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { useGoogleOAuthConfig } from '@/lib/google-oauth'
import { api } from '@/lib/api-client'
import { preloadRoute } from '@/lib/route-preload'
import LandingPage from '@/pages/LandingPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

const LoginPage = lazy(() => import('@/pages/LoginPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const SchedulePage = lazy(() => import('@/pages/SchedulePage'));
const VenuePage = lazy(() => import('@/pages/VenuePage'));
const MyBookingsPage = lazy(() => import('@/pages/MyBookingsPage'));
const AdminPage = lazy(() => import('@/pages/AdminPage'));
const VenueManagementPage = lazy(() => import('@/pages/VenueManagementPage'));
const AdminUsersPage = lazy(() => import('@/pages/AdminUsersPage'));
const AdminSettingsPage = lazy(() => import('@/pages/AdminSettingsPage'));
const BookingHistoryPage = lazy(() => import('@/pages/BookingHistoryPage'));
const AdminAuditTrailPage = lazy(() => import('@/pages/AdminAuditTrailPage'));

function RouteLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

function withSuspense(element: React.ReactNode) {
  return <Suspense fallback={<RouteLoader />}>{element}</Suspense>;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: withSuspense(<LandingPage />),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/login",
    element: withSuspense(<LoginPage />),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/dashboard",
    element: withSuspense(
      <ProtectedRoute requiredRole="USER" disallowAdmin>
        <DashboardPage />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/schedule",
    element: withSuspense(
      <ProtectedRoute requiredRole="USER">
        <SchedulePage />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/venues",
    element: withSuspense(
      <ProtectedRoute requiredRole="USER">
        <VenuePage />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/bookings",
    element: withSuspense(
      <ProtectedRoute requiredRole="USER">
        <MyBookingsPage />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/admin",
    element: withSuspense(
      <ProtectedRoute requiredRole="ADMIN">
        <AdminPage />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/admin/venues",
    element: withSuspense(
      <ProtectedRoute requiredRole="ADMIN">
        <VenueManagementPage />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/admin/users",
    element: withSuspense(
      <ProtectedRoute requiredRole="ADMIN">
        <AdminUsersPage />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/admin/settings",
    element: withSuspense(
      <ProtectedRoute requiredRole="ADMIN">
        <AdminSettingsPage />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/admin/history",
    element: withSuspense(
      <ProtectedRoute requiredRole="ADMIN">
        <BookingHistoryPage />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/admin/audit",
    element: withSuspense(
      <ProtectedRoute requiredRole="ADMIN">
        <AdminAuditTrailPage />
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
    preloadRoute('/');

    const preloadCore = () => {
      void queryClient.prefetchQuery({
        queryKey: ['settings'],
        queryFn: () => api('/api/settings'),
      });
      void queryClient.prefetchQuery({
        queryKey: ['venues'],
        queryFn: () => api('/api/venues'),
      });
      preloadRoute('/login');
    };

    const requestIdle = globalThis.requestIdleCallback;
    const cancelIdle = globalThis.cancelIdleCallback;

    if (typeof requestIdle === 'function' && typeof cancelIdle === 'function') {
      const idleId = requestIdle(preloadCore, { timeout: 1200 });
      return () => cancelIdle(idleId);
    }

    const timer = globalThis.setTimeout(preloadCore, 300);
    return () => globalThis.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        if (!import.meta.env.PROD) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));
          return;
        }

        const registration = await navigator.serviceWorker.register('/sw.js');
        await registration.update();
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
