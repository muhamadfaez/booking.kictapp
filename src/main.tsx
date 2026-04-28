import '@/lib/errorReporter';
import { enableMapSet } from "immer";
enableMapSet();
import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import {
  createBrowserRouter,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { RouteLoader } from '@/components/RouteLoader';
import '@/index.css'
import { AppRoot } from '@/AppRoot';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
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
const ManagerDashboardPage = lazy(() => import('@/pages/ManagerDashboardPage'));

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
    path: "/manager",
    element: withSuspense(
      <ProtectedRoute requiredRole="USER">
        <ManagerDashboardPage />
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
      <AppRoot router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
