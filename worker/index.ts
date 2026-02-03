import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { Env } from './core-utils';
export * from './core-utils';

export type ClientErrorReport = { message: string; url: string; timestamp: string } & Record<string, unknown>;

const app = new Hono<{ Bindings: Env, Variables: { user: any } }>();

// Security Headers
app.use('*', secureHeaders());

// Simple Rate Limiting (In-memory, per-isolate)
const rateInfos = new Map<string, { count: number; lastReset: number }>();
app.use('/api/*', async (c, next) => {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const now = Date.now();

  let info = rateInfos.get(ip);
  if (!info || now - info.lastReset > 60000) {
    info = { count: 0, lastReset: now };
    rateInfos.set(ip, info);
  }

  if (info.count > 100) { // 100 requests per minute per IP
    return c.json({ success: false, error: 'Too many requests' }, 429);
  }

  info.count++;
  await next();
});

app.use('*', logger());

app.use('/api/*', cors({
  origin: (origin) => {
    // Allow localhost during dev, otherwise could restrict
    // For now allowing all is "okay" if we trust the client app, but better to restrict in prod
    return origin || '*';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length', 'X-Kuma-Revision']
}));

app.get('/api/health', (c) => c.json({ success: true, data: { status: 'healthy', timestamp: new Date().toISOString() } }));

app.post('/api/client-errors', async (c) => {
  try {
    const e = await c.req.json<ClientErrorReport>();
    console.error('[CLIENT ERROR]', JSON.stringify({ timestamp: e.timestamp || new Date().toISOString(), message: e.message, url: e.url, stack: e.stack, componentStack: e.componentStack, errorBoundary: e.errorBoundary }, null, 2));
    return c.json({ success: true });
  } catch (error) {
    console.error('[CLIENT ERROR HANDLER] Failed:', error);
    return c.json({ success: false, error: 'Failed to process' }, 500);
  }
});

import { userRoutes } from './user-routes';
import { authRoutes } from './auth-routes';

// Load auth routes
authRoutes(app);
// Load user routes
userRoutes(app);

app.notFound((c) => c.json({ success: false, error: 'Not Found' }, 404));
app.onError((err, c) => { console.error(`[ERROR] ${err}`); return c.json({ success: false, error: 'Internal Server Error' }, 500); });

console.log(`Server is running`)

export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;