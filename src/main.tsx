import '@/lib/errorReporter';
import { enableMapSet } from "immer";
import { Toaster } from "sonner";
enableMapSet();
import { StrictMode } from 'react'
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
import AdminPage from '@/pages/AdminPage'
import VenueManagementPage from '@/pages/VenueManagementPage'
import BookingHistoryPage from '@/pages/BookingHistoryPage'
import SchedulePage from '@/pages/SchedulePage'
import { AuthProvider } from '@/lib/mock-auth'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

const queryClient = new QueryClient();
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

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
    path: "/schedule",
    element: (
      <ProtectedRoute requiredRole="USER">
        <SchedulePage />
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
    <GoogleOAuthProvider clientId={googleClientId}>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <AuthProvider>
            <RouterProvider router={router} />
            <Toaster richColors position="top-center" />
          </AuthProvider>
        </ErrorBoundary>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  </StrictMode>,
)