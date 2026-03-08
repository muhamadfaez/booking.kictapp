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

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

const getAllowedOrigins = (env: Env): Set<string> => {
  const configured = ((env as any).CORS_ALLOWED_ORIGINS as string | undefined) || '';
  const entries = configured
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  // Safe default for local development.
  if (entries.length === 0) {
    return new Set(['http://localhost:3000', 'http://127.0.0.1:3000']);
  }
  return new Set(entries);
};

const isOriginAllowed = (origin: string, env: Env) => getAllowedOrigins(env).has(origin);

const incrementRateLimit = async (env: Env, ip: string, limitPerMinute: number) => {
  const globalDO = env.GlobalDurableObject.get(env.GlobalDurableObject.idFromName('GlobalDurableObject'));
  const bucket = Math.floor(Date.now() / 60000);
  const key = `rl:${ip}:${bucket}`;

  for (let i = 0; i < 5; i++) {
    const current = await globalDO.getDoc<{ count: number; expiresAt: number }>(key);
    const version = current?.v ?? 0;
    const now = Date.now();
    const count = current?.data?.count ?? 0;
    const nextCount = count + 1;
    const ttlMs = 120000;
    const result = await globalDO.casPut(key, version, {
      count: nextCount,
      expiresAt: now + ttlMs
    });
    if (result.ok) {
      return { allowed: nextCount <= limitPerMinute, count: nextCount };
    }
  }
  return { allowed: false, count: limitPerMinute + 1 };
};

app.use('/api/*', async (c, next) => {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const limitPerMinute = parsePositiveInt(((c.env as any).RATE_LIMIT_PER_MINUTE as string | undefined), 120);
  const rl = await incrementRateLimit(c.env, ip, limitPerMinute);
  if (!rl.allowed) {
    return c.json({ success: false, error: 'Too many requests' }, 429);
  }
  await next();
});

app.use('*', logger());

app.use('/api/*', cors({
  origin: (origin, c) => {
    // Non-browser / same-origin requests may not send Origin header.
    if (!origin) return '*';
    if (isOriginAllowed(origin, c.env)) return origin;
    return '';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length', 'X-Kuma-Revision']
}));

app.get('/api/health', (c) => c.json({ success: true, data: { status: 'healthy', timestamp: new Date().toISOString() } }));
app.get('/api/public-config', (c) => c.json({
  success: true,
  data: {
    googleClientId: c.env.GOOGLE_CLIENT_ID || ''
  }
}));

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
