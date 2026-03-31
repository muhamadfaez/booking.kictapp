import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Toaster } from 'sonner';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useGoogleOAuthConfig } from '@/lib/google-oauth';
import { AuthProvider } from '@/lib/mock-auth';
import { preloadRoute } from '@/lib/route-preload';

import type { Router } from '@remix-run/router';

type AppRootProps = {
  router: Router;
};

export function AppRoot({ router }: AppRootProps) {
  const { googleClientId, isGoogleOAuthEnabled } = useGoogleOAuthConfig();

  useEffect(() => {
    const preloadCore = () => {
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
