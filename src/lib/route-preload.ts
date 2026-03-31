const routePreloaders: Record<string, () => Promise<unknown>> = {
  '/login': () => import('@/pages/LoginPage'),
  '/dashboard': () => import('@/pages/DashboardPage'),
  '/admin': () => import('@/pages/AdminPage'),
  '/admin/audit': () => import('@/pages/AdminAuditTrailPage'),
  '/bookings': () => import('@/pages/MyBookingsPage'),
  '/venues': () => import('@/pages/VenuePage'),
};

const preloadedRoutes = new Set<string>();

export function preloadRoute(path: string) {
  const preload = routePreloaders[path];
  if (!preload || preloadedRoutes.has(path)) return;
  preloadedRoutes.add(path);
  void preload();
}

let overlaysPreloaded = false;

export function preloadLandingOverlays() {
  if (overlaysPreloaded) return;
  overlaysPreloaded = true;
  void import('@/components/auth/LoginDialog');
  void import('@/components/booking/BookingWizard');
}
