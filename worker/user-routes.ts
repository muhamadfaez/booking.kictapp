import { Hono } from "hono";
import type { Env } from './core-utils';
import { UserEntity, VenueEntity, BookingEntity, NotificationEntity, AuditTrailEntity } from "./entities";
import { ok, bad, notFound, Index } from './core-utils';
import type { Booking, SessionSlot, AppSettings, BookingStatus, Notification, NotificationType, User, Venue, AuditTrailEntry, AuditAction } from "@shared/types";
import { verify } from 'hono/jwt';
import { getRecentSignIns } from './signin-tracker';
import { GoogleMailService, renderStandardEmail } from './mail';

const verifyAuthStrict = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  if (!c.env.JWT_SECRET || c.env.JWT_SECRET.trim().length < 32) {
    return c.json({ success: false, error: 'Server auth configuration error' }, 500);
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256');
    c.set('user', payload);
    await next();
  } catch {
    return c.json({ success: false, error: 'Invalid Token' }, 401);
  }
};

const verifyAdminStrict = async (c: any, next: any) => {
  const user = c.get('user');
  if (!user || user.role !== 'ADMIN') {
    return c.json({ success: false, error: 'Forbidden: Admin access required' }, 403);
  }
  await next();
};

const BOOKING_LOCK_TTL_MS = 5000;
const BOOKING_LOCK_MAX_RETRIES = 10;
const BOOKING_LOCK_RETRY_DELAY_MS = 60;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml'
]);
const ALLOWED_DOC_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);
const ADMIN_NOTIFICATION_STREAM_KEY = 'stream:notifications:admin';
const USER_NOTIFICATION_STREAM_PREFIX = 'stream:notifications:user:';
const AUDIT_STREAM_KEY = 'stream:audit-trail';
const MAX_STREAM_ITEMS = 250;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type StoredDoc<T> = { v: number; data: T };
type BookingLock = { token: string; expiresAt: number };
type RejectedResult = PromiseRejectedResult;

const isRejectedResult = (result: PromiseSettledResult<unknown>): result is RejectedResult =>
  result.status === 'rejected';

const toMins = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const sessionRange = (session?: SessionSlot): [number, number] | null => {
  switch (session) {
    case 'MORNING': return [480, 720];
    case 'AFTERNOON': return [780, 1020];
    case 'EVENING': return [1080, 1320];
    case 'FULL_DAY': return [480, 1320];
    default: return null;
  }
};

const bookingRange = (startTime?: string, endTime?: string, session?: SessionSlot): [number, number] | null => {
  if (startTime && endTime) return [toMins(startTime), toMins(endTime)];
  return sessionRange(session);
};

const formatBookingWindow = (booking: Pick<Booking, 'date' | 'startTime' | 'endTime' | 'session'>) => {
  if (booking.startTime && booking.endTime) {
    return `${booking.date} ${booking.startTime}-${booking.endTime}`;
  }
  return `${booking.date} ${booking.session?.replace('_', ' ') || 'N/A'}`;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

async function appendToStream<T>(env: Env, key: string, item: T) {
  const globalDO = env.GlobalDurableObject.get(env.GlobalDurableObject.idFromName('GlobalDurableObject'));

  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await globalDO.getDoc(key) as StoredDoc<T[]> | null;
    const version = current?.v ?? 0;
    const items: T[] = current?.data ?? [];
    const next = [item, ...items].slice(0, MAX_STREAM_ITEMS);
    const result = await globalDO.casPut(key, version, next);
    if (result.ok) return;
  }

  throw new Error(`Failed to append stream item for ${key}`);
}

async function readStream<T>(env: Env, key: string): Promise<T[]> {
  const globalDO = env.GlobalDurableObject.get(env.GlobalDurableObject.idFromName('GlobalDurableObject'));
  const current = await globalDO.getDoc(key) as StoredDoc<T[]> | null;
  return current?.data ?? [];
}

async function updateStreamItem<T extends { id: string }>(
  env: Env,
  key: string,
  id: string,
  updater: (item: T) => T
) {
  const globalDO = env.GlobalDurableObject.get(env.GlobalDurableObject.idFromName('GlobalDurableObject'));

  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await globalDO.getDoc(key) as StoredDoc<T[]> | null;
    const version = current?.v ?? 0;
    const items: T[] = current?.data ?? [];
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return false;
    const next = [...items];
    next[index] = updater(next[index]);
    const result = await globalDO.casPut(key, version, next);
    if (result.ok) return true;
  }

  throw new Error(`Failed to update stream item for ${key}`);
}

async function createNotification(env: Env, input: Omit<Notification, 'id' | 'createdAt'> & { createdAt?: number }) {
  const notification: Notification = {
    id: `notif_${crypto.randomUUID()}`,
    createdAt: input.createdAt ?? Date.now(),
    audienceRole: input.audienceRole,
    ...input
  };
  const results = await Promise.allSettled([
    NotificationEntity.create(env, notification),
    appendToStream(
      env,
      notification.audienceRole === 'ADMIN' ? ADMIN_NOTIFICATION_STREAM_KEY : `${USER_NOTIFICATION_STREAM_PREFIX}${notification.userId}`,
      notification
    )
  ]);
  const failures = results.filter(isRejectedResult);
  if (failures.length > 0) {
    console.error('[NOTIFICATION] Persist failure', {
      id: notification.id,
      userId: notification.userId,
      audienceRole: notification.audienceRole,
      type: notification.type,
      title: notification.title,
      failures: failures.map((result) => String(result.reason))
    });
  } else {
    console.log('[NOTIFICATION] Persisted', {
      id: notification.id,
      userId: notification.userId,
      audienceRole: notification.audienceRole,
      type: notification.type,
      title: notification.title
    });
  }
  return notification;
}

async function createAuditEntry(env: Env, input: Omit<AuditTrailEntry, 'id' | 'createdAt'> & { createdAt?: number }) {
  const entry: AuditTrailEntry = {
    id: `audit_${crypto.randomUUID()}`,
    createdAt: input.createdAt ?? Date.now(),
    ...input
  };
  const results = await Promise.allSettled([
    AuditTrailEntity.create(env, entry),
    appendToStream(env, AUDIT_STREAM_KEY, entry)
  ]);
  const failures = results.filter(isRejectedResult);
  if (failures.length > 0) {
    console.error('[AUDIT] Persist failure', {
      id: entry.id,
      action: entry.action,
      actorEmail: entry.actorEmail,
      targetType: entry.targetType,
      targetId: entry.targetId,
      failures: failures.map((result) => String(result.reason))
    });
  } else {
    console.log('[AUDIT] Persisted', {
      id: entry.id,
      action: entry.action,
      actorEmail: entry.actorEmail,
      targetType: entry.targetType,
      targetId: entry.targetId
    });
  }
  return entry;
}

async function logAuditFromContext(
  c: any,
  action: AuditAction,
  summary: string,
  targetType: AuditTrailEntry['targetType'],
  targetId?: string,
  metadata?: AuditTrailEntry['metadata']
) {
  const actor = c.get('user');
  if (!actor?.sub) return;

  let actorEmail = actor.email as string | undefined;
  let actorRole = actor.role as User['role'] | undefined;
  if (!actorEmail) {
    const actorState = await new UserEntity(c.env, actor.sub).getState();
    actorEmail = actorState.email || '';
    actorRole = actorState.role || actorRole;
  }
  if (!actorEmail) {
    actorEmail = `${actor.sub}@local`;
  }

  await createAuditEntry(c.env, {
    actorUserId: actor.sub,
    actorEmail,
    actorRole,
    action,
    summary,
    targetType,
    targetId,
    metadata
  });
}

async function listAdminUsers(env: Env): Promise<User[]> {
  await UserEntity.ensureSeed(env);
  const users = await UserEntity.list(env);
  return users.items.filter((user) => user.role === 'ADMIN');
}

const normalizeLoose = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

async function resolveBookingRequesterEmail(env: Env, booking: Booking, requester?: User) {
  const directEmail = requester?.email || booking.userEmail || '';
  if (directEmail && directEmail.includes('@')) {
    return {
      email: directEmail,
      name: requester?.name || booking.userName || directEmail.split('@')[0]
    };
  }

  const exactUser = await new UserEntity(env, booking.userId).getState();
  if (exactUser.email && exactUser.email.includes('@')) {
    return {
      email: exactUser.email,
      name: exactUser.name || booking.userName || exactUser.email.split('@')[0]
    };
  }

  await UserEntity.ensureSeed(env);
  const users = await UserEntity.list(env);
  const bookingName = normalizeLoose(booking.userName || '');

  const matchedUser = users.items.find((user) => {
    if (user.id === booking.userId) return true;
    if (bookingName && normalizeLoose(user.name || '') === bookingName) return true;
    if (bookingName && normalizeLoose((user.email || '').split('@')[0] || '') === bookingName) return true;
    return false;
  });

  if (matchedUser?.email && matchedUser.email.includes('@')) {
    return {
      email: matchedUser.email,
      name: matchedUser.name || booking.userName || matchedUser.email.split('@')[0]
    };
  }

  return {
    email: '',
    name: requester?.name || booking.userName || 'Requester'
  };
}

function buildRequesterSnapshot(
  authUser: any,
  requesterState: User,
  fallback?: { requesterEmail?: string; requesterName?: string }
): User {
  const email =
    requesterState.email ||
    authUser?.email ||
    fallback?.requesterEmail ||
    '';
  const name =
    requesterState.name ||
    authUser?.name ||
    fallback?.requesterName ||
    (email ? email.split('@')[0] : 'Requester');

  return {
    id: requesterState.id || authUser?.sub,
    email,
    name,
    role: requesterState.role || authUser?.role || 'USER',
    avatar: requesterState.avatar
  };
}

async function syncRequesterProfile(env: Env, requester: User) {
  if (!requester.id) return;

  const entity = new UserEntity(env, requester.id);
  if (await entity.exists()) {
    const current = await entity.getState();
    const updates: Partial<User> = {};
    if (!current.email && requester.email) updates.email = requester.email;
    if (!current.name && requester.name) updates.name = requester.name;
    if (Object.keys(updates).length > 0) {
      await entity.patch(updates);
    }
    return;
  }

  if (!requester.email) return;
  await UserEntity.create(env, {
    id: requester.id,
    email: requester.email,
    name: requester.name || requester.email.split('@')[0],
    role: requester.role || 'USER',
    avatar: requester.avatar
  });
}

async function sendEmailSafe(env: Env, to: string, subject: string, html: string) {
  if (!to || !to.includes('@')) {
    console.error('[MAIL] Missing recipient email', { to, subject });
    return { ok: false as const, error: 'Missing recipient email' };
  }

  try {
    const mailer = new GoogleMailService(env);
    await mailer.sendEmail(to, subject, { html });
    console.log('[MAIL] Sent', { to, subject });
    return { ok: true as const };
  } catch (error) {
    console.error('[MAIL] Failed to send email', {
      to,
      subject,
      error: error instanceof Error ? error.message : String(error)
    });
    try {
      const mailer = new GoogleMailService(env);
      await mailer.sendEmail(to, subject, { html });
      console.log('[MAIL] Sent on retry', { to, subject });
      return { ok: true as const };
    } catch (retryError) {
      console.error('[MAIL] Retry failed', {
        to,
        subject,
        error: retryError instanceof Error ? retryError.message : String(retryError)
      });
      return {
        ok: false as const,
        error: retryError instanceof Error ? retryError.message : 'Unknown email delivery failure'
      };
    }
  }
}

async function createAdminNotifications(
  env: Env,
  input: Omit<Notification, 'id' | 'createdAt' | 'userId'> & { createdAt?: number }
) {
  const admins = await listAdminUsers(env);
  if (admins.length === 0) {
    console.warn('[NOTIFICATION] No admin users available for admin notification', {
      type: input.type,
      title: input.title
    });
    return [];
  }

  return Promise.all(
    admins.map((admin) =>
      createNotification(env, {
        userId: admin.id,
        audienceRole: 'ADMIN',
        ...input
      })
    )
  );
}

async function sendAdminBookingEmail(env: Env, booking: Booking, requester: User, venue: Venue) {
  const admins = await listAdminUsers(env);
  if (admins.length === 0) {
    console.warn('[BOOKING] No admins available for booking notification', {
      bookingId: booking.id,
      venueId: booking.venueId
    });
    return;
  }

  const subject = `New booking request for ${venue.name}`;
  const html = renderStandardEmail({
    eyebrow: 'New Booking Request',
    title: venue.name,
    intro: `${requester.name} submitted a booking request that requires admin review.`,
    sections: [
      { label: 'Requester', value: `${requester.name} (${requester.email})` },
      { label: 'Schedule', value: formatBookingWindow(booking) },
      { label: 'Purpose', value: booking.purpose },
      { label: 'Status', value: 'Pending approval' }
    ],
    footer: 'Review the request from the admin dashboard to approve or reject it.'
  });

  await Promise.all(
    admins.map(async (admin) => {
      await createNotification(env, {
        userId: admin.id,
        audienceRole: 'ADMIN',
        type: 'BOOKING_CREATED',
        title: 'New booking request',
        message: `${requester.name || booking.userName} requested ${venue.name} for ${formatBookingWindow(booking)}.`,
        bookingId: booking.id,
        venueId: booking.venueId,
        link: '/admin'
      });
      await sendEmailSafe(env, admin.email, subject, html);
    })
  );
}

async function sendRequesterStatusUpdate(env: Env, booking: Booking, requester: User, venue: Venue, status: 'APPROVED' | 'REJECTED') {
  const resolvedRecipient = await resolveBookingRequesterEmail(env, booking, requester);
  const recipientEmail = resolvedRecipient.email;
  const recipientName = resolvedRecipient.name;
  const statusLabel = status === 'APPROVED' ? 'approved' : 'rejected';
  const title = status === 'APPROVED' ? 'Booking approved' : 'Booking rejected';
  const subject = `${venue.name} booking ${statusLabel}`;
  const html = renderStandardEmail({
    eyebrow: status === 'APPROVED' ? 'Booking Receipt' : 'Booking Update',
    title: title,
    intro: status === 'APPROVED'
      ? `Hi ${recipientName}, your booking for ${venue.name} has been approved. This email serves as your booking receipt.`
      : `Hi ${recipientName}, your booking for ${venue.name} was rejected after review.`,
    accent: status === 'APPROVED' ? '#0f8f6f' : '#b91c1c',
    sections: [
      { label: 'Requester', value: `${recipientName}${recipientEmail ? ` (${recipientEmail})` : ''}` },
      { label: 'Venue', value: venue.name },
      { label: 'Schedule', value: formatBookingWindow(booking) },
      { label: 'Purpose', value: booking.purpose },
      { label: 'Status', value: status }
    ],
    footer: status === 'APPROVED'
      ? 'Please keep this receipt and bring any required supporting documents on the booking date.'
      : 'You may submit a new request after adjusting the booking details if needed.'
  });

  await createNotification(env, {
    userId: requester.id || booking.userId,
    audienceRole: 'USER',
    type: status === 'APPROVED' ? 'BOOKING_APPROVED' : 'BOOKING_REJECTED',
    title,
    message: `${venue.name} on ${formatBookingWindow(booking)} was ${statusLabel}.`,
    bookingId: booking.id,
    venueId: booking.venueId,
    link: '/bookings'
  });

  await createAdminNotifications(env, {
    type: status === 'APPROVED' ? 'BOOKING_APPROVED' : 'BOOKING_REJECTED',
    title: `Booking ${statusLabel}`,
    message: `${recipientName} ${status === 'APPROVED' ? 'received approval for' : 'had a rejection for'} ${venue.name} on ${formatBookingWindow(booking)}.`,
    bookingId: booking.id,
    venueId: booking.venueId,
    link: '/admin/history'
  });

  const emailResult = await sendEmailSafe(env, recipientEmail, subject, html);
  console.log('[BOOKING] Status update processed', {
    bookingId: booking.id,
    status,
    recipientEmail,
    recipientName,
    emailSent: emailResult.ok
  });
  if (!emailResult.ok) {
    await createAdminNotifications(env, {
      type: 'BOOKING_UPDATED',
      title: 'Receipt email delivery failed',
      message: `Could not send ${statusLabel} email for ${venue.name} (${booking.id}). ${emailResult.error || 'Unknown error'}.`,
      bookingId: booking.id,
      venueId: booking.venueId,
      link: '/admin/history'
    });
  }
}

async function withBookingLock<T>(c: any, venueId: string, date: string, fn: () => Promise<T>): Promise<T> {
  const globalDO = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName('GlobalDurableObject'));
  const lockKey = `lock:booking:${venueId}:${date}`;
  const ownerToken = crypto.randomUUID();
  let acquired = false;

  for (let attempt = 0; attempt < BOOKING_LOCK_MAX_RETRIES; attempt++) {
    const now = Date.now();
    const doc = await globalDO.getDoc(lockKey) as StoredDoc<BookingLock> | null;
    const currentVersion = doc?.v ?? 0;
    const currentData = doc?.data;

    if (!currentData || currentData.expiresAt <= now) {
      const lockResult = await globalDO.casPut(lockKey, currentVersion, {
        token: ownerToken,
        expiresAt: now + BOOKING_LOCK_TTL_MS
      });
      if (lockResult.ok) {
        acquired = true;
        break;
      }
    }
    await sleep(BOOKING_LOCK_RETRY_DELAY_MS);
  }

  if (!acquired) {
    throw new Error('Could not acquire booking lock');
  }

  try {
    return await fn();
  } finally {
    const doc = await globalDO.getDoc(lockKey) as StoredDoc<BookingLock> | null;
    if (doc?.data?.token === ownerToken) {
      await globalDO.casPut(lockKey, doc.v, { token: 'released', expiresAt: 0 });
    }
  }
}

type BookingSubmissionInput = {
  venueId: string;
  date: string;
  session?: SessionSlot;
  startTime?: string;
  endTime?: string;
  purpose: string;
  programType?: Booking['programType'];
  documents?: Booking['documents'];
};

async function createBookingSubmission(
  c: any,
  requester: User,
  venueData: Venue,
  input: BookingSubmissionInput
): Promise<Booking> {
  return withBookingLock(c, input.venueId, input.date, async () => {
    const available = await BookingEntity.checkAvailability(
      c.env,
      input.venueId,
      input.date,
      input.startTime,
      input.endTime,
      input.session
    );
    if (!available) {
      throw new Error(`This slot is already reserved or pending approval on ${input.date}`);
    }

    const booking: Booking = {
      id: crypto.randomUUID(),
      venueId: input.venueId,
      userId: requester.id,
      userName: requester.name || requester.email.split('@')[0],
      userEmail: requester.email || c.get('user')?.email || '',
      date: input.date,
      session: input.session,
      startTime: input.startTime,
      endTime: input.endTime,
      status: 'PENDING',
      createdAt: Date.now(),
      purpose: input.purpose,
      programType: input.programType,
      documents: input.documents
    };

    return BookingEntity.create(c.env, booking);
  });
}

export function userRoutes(app: Hono<{ Bindings: Env, Variables: { user: any } }>) {
  const normalizeEmail = (value: string) => value.trim().toLowerCase();
  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const userIdFromEmail = (email: string) => `user_${normalizeEmail(email).replace(/[^a-zA-Z0-9]/g, '_')}`;

  // SEED INITIAL DATA (Admin Only)
  app.get('/api/init', verifyAuthStrict, verifyAdminStrict, async (c) => {
    await UserEntity.ensureSeed(c.env);
    await VenueEntity.ensureSeed(c.env);
    await BookingEntity.ensureSeed(c.env);
    return ok(c, "Seeded");
  });

  // SETTINGS (Public Read)
  app.get('/api/settings', async (c) => {
    const globalDO = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName('GlobalDurableObject'));
    const doc = await globalDO.getDoc('settings:app') as StoredDoc<AppSettings> | null;
    return ok(c, doc?.data ?? {});
  });

  // SETTINGS (Admin Write)
  app.post('/api/settings/hero-image', verifyAuthStrict, verifyAdminStrict, async (c) => {
    const { heroImageUrl } = await c.req.json() as { heroImageUrl?: string };
    if (!heroImageUrl || typeof heroImageUrl !== 'string') {
      return bad(c, 'Missing heroImageUrl');
    }

    const globalDO = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName('GlobalDurableObject'));
    for (let i = 0; i < 3; i++) {
      const doc = await globalDO.getDoc('settings:app') as StoredDoc<AppSettings> | null;
      const current: AppSettings = doc?.data ?? {};
      const version = doc?.v ?? 0;

      const res = await globalDO.casPut('settings:app', version, { ...current, heroImageUrl });
      if (res.ok) {
        await logAuditFromContext(c, 'SETTINGS_UPDATED', 'Updated landing hero image', 'SETTINGS', 'hero-image');
        return ok(c, { heroImageUrl });
      }
    }
    return bad(c, 'Failed to update settings. Please retry.');
  });

  app.post('/api/settings/branding', verifyAuthStrict, verifyAdminStrict, async (c) => {
    const { appName, appLabel, appIconUrl } = await c.req.json() as AppSettings;
    const updates: AppSettings = {};

    if (appName !== undefined) updates.appName = String(appName).trim();
    if (appLabel !== undefined) updates.appLabel = String(appLabel).trim();
    if (appIconUrl !== undefined) updates.appIconUrl = String(appIconUrl).trim();

    const globalDO = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName('GlobalDurableObject'));
    for (let i = 0; i < 3; i++) {
      const doc = await globalDO.getDoc('settings:app') as StoredDoc<AppSettings> | null;
      const current: AppSettings = doc?.data ?? {};
      const version = doc?.v ?? 0;
      const res = await globalDO.casPut('settings:app', version, { ...current, ...updates });
      if (res.ok) {
        await logAuditFromContext(c, 'SETTINGS_UPDATED', 'Updated branding settings', 'SETTINGS', 'branding', {
          appName: updates.appName ?? null,
          appLabel: updates.appLabel ?? null,
          hasAppIcon: Boolean(updates.appIconUrl)
        });
        return ok(c, { ...current, ...updates });
      }
    }
    return bad(c, 'Failed to update branding settings. Please retry.');
  });

  // VENUES (Public Read)
  app.get('/api/venues', async (c) => {
    await VenueEntity.ensureSeed(c.env);
    const venueIndex = new Index<string>(c.env, VenueEntity.indexName);
    const ids = await venueIndex.list();
    const settled = await Promise.all(ids.map(async (id) => {
      const venue = new VenueEntity(c.env, id);
      if (await venue.exists()) {
        return { id, venue: await venue.getState(), stale: false as const };
      }
      return { id, venue: null, stale: true as const };
    }));

    const staleIds = settled.filter((entry) => entry.stale).map((entry) => entry.id);
    if (staleIds.length > 0) {
      await venueIndex.removeBatch(staleIds);
    }

    const items = settled
      .filter((entry): entry is { id: string; venue: Venue; stale: false } => entry.venue !== null)
      .map((entry) => entry.venue);

    return ok(c, items);
  });

  app.get('/api/venues/availability', async (c) => {
    const date = c.req.query('date');
    const session = c.req.query('session') as SessionSlot | undefined;
    const startTime = c.req.query('startTime') || undefined;
    const endTime = c.req.query('endTime') || undefined;

    if (!date) return bad(c, 'Missing date');
    const requestedRange = bookingRange(startTime, endTime, session);
    if (!requestedRange) return bad(c, 'Missing time selection');

    await VenueEntity.ensureSeed(c.env);
    const venues = await VenueEntity.list(c.env);
    const bookings = await BookingEntity.list(c.env);

    const unavailableVenueIds = new Set<string>();
    const [reqStart, reqEnd] = requestedRange;

    for (const v of venues.items) {
      if (v.isAvailable === false) {
        unavailableVenueIds.add(v.id);
      }
    }

    for (const b of bookings.items) {
      if (b.date !== date) continue;
      if (b.status === 'CANCELLED' || b.status === 'REJECTED') continue;
      const existingRange = bookingRange(b.startTime, b.endTime, b.session);
      if (!existingRange) continue;
      const [existStart, existEnd] = existingRange;
      if (reqStart < existEnd && reqEnd > existStart) {
        unavailableVenueIds.add(b.venueId);
      }
    }

    const availableVenueIds = venues.items
      .filter((v) => !unavailableVenueIds.has(v.id))
      .map((v) => v.id);

    return ok(c, {
      date,
      session: session ?? null,
      startTime: startTime ?? null,
      endTime: endTime ?? null,
      availableVenueIds,
      unavailableVenueIds: Array.from(unavailableVenueIds)
    });
  });

  app.post('/api/venues', verifyAuthStrict, verifyAdminStrict, async (c) => {
    const body = await c.req.json() as any;
    const { name, location, capacity, description, imageUrl, amenities, isAvailable, unavailableReason } = body;

    if (!name || !location || !capacity) {
      return bad(c, 'Missing required fields: name, location, capacity');
    }

    const newVenue = {
      id: `venue_${crypto.randomUUID().slice(0, 8)}`,
      name,
      location,
      capacity: Number(capacity),
      description: description || '',
      imageUrl: imageUrl || '',
      amenities: amenities || [],
      isAvailable: isAvailable !== false,
      unavailableReason: isAvailable === false ? String(unavailableReason || '').trim() : ''
    };

    const created = await VenueEntity.create(c.env, newVenue);
    await logAuditFromContext(c, 'VENUE_CREATED', `Created venue ${created.name}`, 'VENUE', created.id, {
      location: created.location,
      capacity: created.capacity
    });
    return ok(c, created);
  });

  app.put('/api/venues/:id', verifyAuthStrict, verifyAdminStrict, async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json() as any;

    const venue = new VenueEntity(c.env, id);
    if (!await venue.exists()) return notFound(c, 'Venue not found');

    const { name, location, capacity, description, imageUrl, amenities, isAvailable, unavailableReason } = body;
    const updates: any = {};

    if (name !== undefined) updates.name = name;
    if (location !== undefined) updates.location = location;
    if (capacity !== undefined) updates.capacity = Number(capacity);
    if (description !== undefined) updates.description = description;
    if (imageUrl !== undefined) updates.imageUrl = imageUrl;
    if (amenities !== undefined) updates.amenities = amenities;
    if (isAvailable !== undefined) updates.isAvailable = Boolean(isAvailable);
    if (unavailableReason !== undefined) updates.unavailableReason = String(unavailableReason).trim();
    if (updates.isAvailable === true && unavailableReason === undefined) {
      updates.unavailableReason = '';
    }

    await venue.patch(updates);
    const updatedVenue = await venue.getState();
    await logAuditFromContext(c, 'VENUE_UPDATED', `Updated venue ${updatedVenue.name}`, 'VENUE', updatedVenue.id, {
      location: updatedVenue.location,
      capacity: updatedVenue.capacity,
      isAvailable: updatedVenue.isAvailable !== false
    });
    return ok(c, updatedVenue);
  });

  app.delete('/api/venues/:id', verifyAuthStrict, verifyAdminStrict, async (c) => {
    const id = c.req.param('id');

    const venue = new VenueEntity(c.env, id);
    if (!await venue.exists()) return notFound(c, 'Venue not found');

    // Check if there are any bookings for this venue
    const bookingsList = await BookingEntity.list(c.env);
    const venueBookings = bookingsList.items.filter(b => b.venueId === id && b.status !== 'CANCELLED');

    if (venueBookings.length > 0) {
      return bad(c, 'Cannot delete venue with active bookings');
    }

    const venueData = await venue.getState();
    await venue.delete();
    await logAuditFromContext(c, 'VENUE_DELETED', `Deleted venue ${venueData.name}`, 'VENUE', id);
    return ok(c, { deleted: true, id });
  });

  // BOOKINGS
  app.get('/api/bookings', verifyAuthStrict, async (c) => {
    await BookingEntity.ensureSeed(c.env);
    const user = c.get('user');
    const statusQuery = c.req.query('status');
    const requestedStatus = statusQuery as BookingStatus | undefined;
    const allowedStatuses: BookingStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];
    const hasValidStatusFilter = requestedStatus ? allowedStatuses.includes(requestedStatus) : false;

    // If admin, allow viewing all or filtering by userId query
    // If user, force filtering by their own ID

    const list = await BookingEntity.list(c.env);
    const statusFiltered = hasValidStatusFilter ? list.items.filter(b => b.status === requestedStatus) : list.items;

    if (user.role === 'ADMIN') {
      const userIdParam = c.req.query('userId');
      if (userIdParam) {
        return ok(c, statusFiltered.filter(b => b.userId === userIdParam));
      }
      return ok(c, statusFiltered);
    } else {
      // Regular user: Only see own bookings
      return ok(c, statusFiltered.filter(b => b.userId === user.sub));
    }
  });

  app.get('/api/bookings/occupancy', verifyAuthStrict, async (c) => {
    await BookingEntity.ensureSeed(c.env);
    const user = c.get('user');
    const list = await BookingEntity.list(c.env);
    const active = list.items.filter((b) => b.status !== 'CANCELLED' && b.status !== 'REJECTED');

    if (user.role === 'ADMIN') {
      return ok(c, active);
    }

    // For non-admin users, mask other users' identities/purposes while still exposing occupancy.
    const masked = active.map((b) => {
      if (b.userId === user.sub) return b;
      return {
        ...b,
        userName: 'Reserved',
        purpose: 'Reserved'
      };
    });
    return ok(c, masked);
  });

  // ADMIN USER ROLE MANAGEMENT
  app.get('/api/admin/users', verifyAuthStrict, verifyAdminStrict, async (c) => {
    await UserEntity.ensureSeed(c.env);
    const users = await UserEntity.list(c.env);
    return ok(c, users.items);
  });

  app.post('/api/admin/users', verifyAuthStrict, verifyAdminStrict, async (c) => {
    const body = await c.req.json() as { email?: string; name?: string; role?: 'USER' | 'ADMIN' };
    const email = normalizeEmail(body.email || '');
    const role = body.role === 'ADMIN' ? 'ADMIN' : 'USER';

    if (!isValidEmail(email)) {
      return bad(c, 'Valid email is required');
    }

    const id = userIdFromEmail(email);
    const user = new UserEntity(c.env, id);
    if (await user.exists()) {
      return bad(c, 'User already exists');
    }

    const created = await UserEntity.create(c.env, {
      id,
      email,
      name: (body.name || '').trim() || email.split('@')[0],
      role,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`
    });
    await logAuditFromContext(c, 'USER_CREATED', `Created user ${created.email}`, 'USER', created.id, {
      role: created.role
    });
    return ok(c, created);
  });

  app.put('/api/admin/users/:id', verifyAuthStrict, verifyAdminStrict, async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json() as { name?: string; role?: 'USER' | 'ADMIN' };
    const user = new UserEntity(c.env, id);
    if (!await user.exists()) return notFound(c, 'User not found');

    const updates: Partial<{ name: string; role: 'USER' | 'ADMIN' }> = {};
    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.role !== undefined) {
      if (body.role !== 'USER' && body.role !== 'ADMIN') {
        return bad(c, 'Role must be USER or ADMIN');
      }
      updates.role = body.role;
    }

    if (Object.keys(updates).length === 0) return bad(c, 'No updates provided');

    await user.patch(updates);
    const updatedUser = await user.getState();
    await logAuditFromContext(c, 'USER_UPDATED', `Updated user ${updatedUser.email}`, 'USER', updatedUser.id, {
      role: updatedUser.role
    });
    return ok(c, updatedUser);
  });

  app.post('/api/admin/users/:id/role', verifyAuthStrict, verifyAdminStrict, async (c) => {
    const id = c.req.param('id');
    const { role } = await c.req.json() as { role?: 'USER' | 'ADMIN' };
    if (!role || (role !== 'USER' && role !== 'ADMIN')) {
      return bad(c, 'Role must be USER or ADMIN');
    }

    const user = new UserEntity(c.env, id);
    if (!await user.exists()) return notFound(c, 'User not found');

    await user.patch({ role });
    const updatedUser = await user.getState();
    await logAuditFromContext(c, 'USER_UPDATED', `Changed role for ${updatedUser.email} to ${updatedUser.role}`, 'USER', updatedUser.id, {
      role: updatedUser.role
    });
    return ok(c, updatedUser);
  });

  app.delete('/api/admin/users/:id', verifyAuthStrict, verifyAdminStrict, async (c) => {
    const id = c.req.param('id');
    const requester = c.get('user');
    if (requester?.sub === id) {
      return bad(c, 'You cannot delete your own account');
    }

    const user = new UserEntity(c.env, id);
    if (!await user.exists()) return notFound(c, 'User not found');
    const state = await user.getState();

    if (state.role === 'ADMIN') {
      const users = await UserEntity.list(c.env);
      const adminCount = users.items.filter((u) => u.role === 'ADMIN').length;
      if (adminCount <= 1) {
        return bad(c, 'Cannot delete the last admin account');
      }
    }

    await UserEntity.delete(c.env, id);
    await logAuditFromContext(c, 'USER_DELETED', `Deleted user ${state.email}`, 'USER', id, {
      role: state.role
    });
    return ok(c, { deleted: true, id });
  });

  app.get('/api/admin/signins-24h', verifyAuthStrict, verifyAdminStrict, async (c) => {
    const items = await getRecentSignIns(c.env);
    return ok(c, {
      windowHours: 24,
      count: items.length,
      items
    });
  });

  app.get('/api/admin/audit-trail', verifyAuthStrict, verifyAdminStrict, async (c) => {
    const items = (await readStream<AuditTrailEntry>(c.env, AUDIT_STREAM_KEY))
      .filter((entry) => entry.targetType !== 'AUTH')
      .sort((a, b) => b.createdAt - a.createdAt);
    console.log('[AUDIT] Admin audit trail requested', { count: items.length });
    return ok(c, items);
  });

  app.get('/api/notifications', verifyAuthStrict, async (c) => {
    const user = c.get('user');
    const items = user.role === 'ADMIN'
      ? await readStream<Notification>(c.env, ADMIN_NOTIFICATION_STREAM_KEY)
      : await readStream<Notification>(c.env, `${USER_NOTIFICATION_STREAM_PREFIX}${user.sub}`);
    console.log('[NOTIFICATION] List requested', {
      userId: user.sub,
      role: user.role,
      count: items.length
    });
    return ok(c, items);
  });

  app.post('/api/notifications/:id/read', verifyAuthStrict, async (c) => {
    const user = c.get('user');
    const notificationId = c.req.param('id');
    const streamKey = user.role === 'ADMIN' ? ADMIN_NOTIFICATION_STREAM_KEY : `${USER_NOTIFICATION_STREAM_PREFIX}${user.sub}`;
    const markedAt = Date.now();
    const updated = await updateStreamItem<Notification>(c.env, streamKey, notificationId, (item) => ({
      ...item,
      readAt: item.readAt ?? markedAt
    }));

    const notification = new NotificationEntity(c.env, notificationId);
    if (await notification.exists()) {
      const current = await notification.getState();
      if (current.userId === user.sub || (user.role === 'ADMIN' && current.audienceRole === 'ADMIN')) {
        await notification.patch({ readAt: current.readAt ?? markedAt });
      }
    }

    if (!updated) return notFound(c, 'Notification not found');
    const items = await readStream<Notification>(c.env, streamKey);
    console.log('[NOTIFICATION] Marked read', {
      notificationId,
      userId: user.sub,
      role: user.role
    });
    return ok(c, items.find((item) => item.id === notificationId) || null);
  });

  app.post('/api/bookings', verifyAuthStrict, async (c) => {
    const body = await c.req.json() as Partial<Booking> & { requesterEmail?: string; requesterName?: string };
    const user = c.get('user');
    const { venueId, date, session, startTime, endTime, purpose } = body;

    // Use userId from token, ignore body userId
    const userId = user.sub;
    const requesterState = await new UserEntity(c.env, userId).getState();
    const requester = buildRequesterSnapshot(user, { ...requesterState, id: requesterState.id || userId }, {
      requesterEmail: body.requesterEmail,
      requesterName: body.requesterName
    });
    await syncRequesterProfile(c.env, requester);

    // Validation
    if (!venueId || !date || (!session && (!startTime || !endTime)) || !purpose) {
      return bad(c, 'Missing required booking fields');
    }

    const venue = new VenueEntity(c.env, venueId);
    if (!await venue.exists()) {
      return notFound(c, 'Venue not found');
    }
    const venueData = await venue.getState();
    if (venueData.isAvailable === false) {
      const reason = venueData.unavailableReason ? ` (${venueData.unavailableReason})` : '';
      return bad(c, `Venue is unavailable for booking${reason}`);
    }

    try {
      const created = await createBookingSubmission(c, requester, venueData, {
        venueId,
        date,
        session: session as SessionSlot,
        startTime,
        endTime,
        purpose,
        programType: body.programType,
        documents: body.documents
      });

      await sendAdminBookingEmail(c.env, created, requester, venueData);
      await createNotification(c.env, {
        userId,
        audienceRole: 'USER',
        type: 'BOOKING_CREATED',
        title: 'Booking submitted',
        message: `Your request for ${venueData.name} on ${formatBookingWindow(created)} was submitted.`,
        bookingId: created.id,
        venueId: created.venueId,
        link: '/bookings'
      });
      await logAuditFromContext(c, 'BOOKING_CREATED', `Created booking for ${venueData.name} on ${created.date}`, 'BOOKING', created.id, {
        venueId: created.venueId,
        date: created.date
      });
      console.log('[BOOKING] Created', {
        bookingId: created.id,
        venueId: created.venueId,
        requesterId: requester.id,
        requesterEmail: requester.email
      });

      return ok(c, created);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create booking';
      return bad(c, message);
    }
  });

  app.post('/api/bookings/batch', verifyAuthStrict, async (c) => {
    const body = await c.req.json() as {
      venueId?: string;
      dates?: string[];
      session?: SessionSlot;
      startTime?: string;
      endTime?: string;
      purpose?: string;
      programType?: Booking['programType'];
      documents?: Booking['documents'];
      requesterEmail?: string;
      requesterName?: string;
    };
    const user = c.get('user');
    const venueId = body.venueId;
    const purpose = body.purpose?.trim();
    const uniqueDates = Array.from(new Set((body.dates ?? []).filter(Boolean))).sort();

    if (!venueId || uniqueDates.length === 0 || (!body.session && (!body.startTime || !body.endTime)) || !purpose) {
      return bad(c, 'Missing required booking fields');
    }

    const venue = new VenueEntity(c.env, venueId);
    if (!await venue.exists()) {
      return notFound(c, 'Venue not found');
    }
    const venueData = await venue.getState();
    if (venueData.isAvailable === false) {
      const reason = venueData.unavailableReason ? ` (${venueData.unavailableReason})` : '';
      return bad(c, `Venue is unavailable for booking${reason}`);
    }

    const requesterState = await new UserEntity(c.env, user.sub).getState();
    const requester = buildRequesterSnapshot(user, { ...requesterState, id: requesterState.id || user.sub }, {
      requesterEmail: body.requesterEmail,
      requesterName: body.requesterName
    });
    await syncRequesterProfile(c.env, requester);

    try {
      const createdBookings: Booking[] = [];
      for (const bookingDate of uniqueDates) {
        const created = await createBookingSubmission(c, requester, venueData, {
          venueId,
          date: bookingDate,
          session: body.session,
          startTime: body.startTime,
          endTime: body.endTime,
          purpose,
          programType: body.programType,
          documents: body.documents
        });
        createdBookings.push(created);
      }

      await Promise.all([
        ...createdBookings.map((booking) => sendAdminBookingEmail(c.env, booking, requester, venueData)),
        ...createdBookings.map((booking) =>
          createNotification(c.env, {
            userId: requester.id,
            audienceRole: 'USER',
            type: 'BOOKING_CREATED',
            title: 'Booking submitted',
            message: `Your request for ${venueData.name} on ${formatBookingWindow(booking)} was submitted.`,
            bookingId: booking.id,
            venueId: booking.venueId,
            link: '/bookings'
          })
        )
      ]);
      await logAuditFromContext(c, 'BOOKING_BATCH_CREATED', `Created ${createdBookings.length} bookings for ${venueData.name}`, 'BOOKING', createdBookings[0]?.id, {
        venueId,
        count: createdBookings.length
      });
      console.log('[BOOKING] Batch created', {
        count: createdBookings.length,
        venueId,
        requesterId: requester.id,
        requesterEmail: requester.email
      });

      return ok(c, {
        count: createdBookings.length,
        items: createdBookings
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create bookings';
      return bad(c, message);
    }
  });

  app.post('/api/bookings/:id/status', verifyAuthStrict, verifyAdminStrict, async (c) => {
    const id = c.req.param('id');
    const { status } = await c.req.json() as { status: string };
    const booking = new BookingEntity(c.env, id);
    if (!await booking.exists()) return notFound(c, 'Booking not found');
    const currentBooking = await booking.getState();
    const requesterState = await new UserEntity(c.env, currentBooking.userId).getState();
    const requester: User = {
      id: requesterState.id || currentBooking.userId,
      email: requesterState.email || currentBooking.userEmail || '',
      name: requesterState.name || currentBooking.userName || 'Requester',
      role: requesterState.role || 'USER',
      avatar: requesterState.avatar
    };
    const venue = await new VenueEntity(c.env, currentBooking.venueId).getState();
    const resolvedRecipient = await resolveBookingRequesterEmail(c.env, currentBooking, requester);
    if (resolvedRecipient.email && resolvedRecipient.email !== currentBooking.userEmail) {
      await booking.patch({ userEmail: resolvedRecipient.email });
      currentBooking.userEmail = resolvedRecipient.email;
    }
    console.log('[BOOKING] Status update requested', {
      bookingId: id,
      currentStatus: currentBooking.status,
      nextStatus: status,
      requesterId: requester.id,
      requesterEmail: resolvedRecipient.email || requester.email || currentBooking.userEmail || '',
      venueId: currentBooking.venueId
    });

    // Privacy & Cleanup: If rejected, delete associated documents
    if (status === 'REJECTED') {
      if (currentBooking.documents) {
        try {
          const { GoogleDriveService } = await import('./drive');
          const drive = new GoogleDriveService(c.env);

          const docUrls = Object.values(currentBooking.documents).filter(url => typeof url === 'string') as string[];

          for (const docUrl of docUrls) {
            const match = docUrl.match(/\/api\/images\/([a-zA-Z0-9-_]+)/);
            if (match && match[1]) {
              console.log(`Deleting rejected file: ${match[1]}`);
              await drive.deleteFile(match[1]);
            }
          }
        } catch (err) {
          console.error('Failed to clean up rejected files:', err);
        }
      }
    }

    await booking.patch({ status: status as any });
    const updatedBooking = await booking.getState();

    if (status === 'APPROVED' || status === 'REJECTED') {
      await sendRequesterStatusUpdate(c.env, updatedBooking, requester, venue, status);
    }
    await logAuditFromContext(
      c,
      status === 'APPROVED' ? 'BOOKING_APPROVED' : 'BOOKING_REJECTED',
      `${status} booking ${updatedBooking.id} for ${venue.name}`,
      'BOOKING',
      updatedBooking.id,
      {
        venueId: updatedBooking.venueId,
        userId: updatedBooking.userId
      }
    );

    return ok(c, updatedBooking);
  });

  app.delete('/api/bookings/:id', verifyAuthStrict, async (c) => {
    const id = c.req.param('id');
    const user = c.get('user');

    const booking = new BookingEntity(c.env, id);
    if (!await booking.exists()) return notFound(c, 'Booking not found');

    const bookingData = await booking.getState();

    // Only allow cancellation if user owns the booking or is admin
    if (user.role !== 'ADMIN' && bookingData.userId !== user.sub) {
      return bad(c, 'Unauthorized: You can only cancel your own bookings');
    }

    const isAdmin = user.role === 'ADMIN';

    if (isAdmin) {
      if (bookingData.status !== 'PENDING' && bookingData.status !== 'APPROVED') {
        return bad(c, 'Admins can only cancel pending or approved bookings');
      }
    } else if (bookingData.status !== 'PENDING') {
      return bad(c, 'Only pending bookings can be cancelled');
    }

    await booking.patch({ status: 'CANCELLED' });
    const updatedBooking = await booking.getState();
    const venue = await new VenueEntity(c.env, bookingData.venueId).getState();
    if (isAdmin) {
      await createNotification(c.env, {
        userId: updatedBooking.userId,
        audienceRole: 'USER',
        type: 'BOOKING_CANCELLED',
        title: 'Booking cancelled by admin',
        message: `${venue.name} on ${formatBookingWindow(updatedBooking)} was cancelled by an administrator.`,
        bookingId: updatedBooking.id,
        venueId: updatedBooking.venueId,
        link: '/bookings'
      });
    } else {
      const admins = await listAdminUsers(c.env);
      await Promise.all(admins.map((admin) =>
        createNotification(c.env, {
          userId: admin.id,
          audienceRole: 'ADMIN',
          type: 'BOOKING_CANCELLED',
          title: 'Booking cancelled',
          message: `${bookingData.userName} cancelled ${venue.name} for ${formatBookingWindow(bookingData)}.`,
          bookingId: bookingData.id,
          venueId: bookingData.venueId,
          link: '/admin/history'
        })
      ));
    }
    await logAuditFromContext(c, 'BOOKING_CANCELLED', `Cancelled booking ${bookingData.id} for ${venue.name}`, 'BOOKING', bookingData.id, {
      venueId: bookingData.venueId,
      userId: bookingData.userId,
      cancelledBy: isAdmin ? 'ADMIN' : 'USER',
      previousStatus: bookingData.status
    });
    return ok(c, updatedBooking);
  });

  // IMAGES PROXY
  app.get('/api/images/:id', async (c) => {
    const id = c.req.param('id');
    try {
      const { GoogleDriveService } = await import('./drive');
      const drive = new GoogleDriveService(c.env);

      const { stream, contentType } = await drive.getFileStream(id);

      return new Response(stream, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      });
    } catch (err) {
      console.error('Proxy error:', err);
      return notFound(c, 'Image not found or inaccessible');
    }
  });

  // UPLOADS
  app.post('/api/upload', verifyAuthStrict, async (c) => {
    try {
      const body = await c.req.parseBody();
      const file = body['file'];

      if (!(file instanceof File)) {
        return bad(c, 'No file provided');
      }

      const docType = body['docType'] as string || 'DOC';
      const purpose = body['purpose'] as string || 'UnknownPurpose';
      const date = body['date'] as string || 'UnknownDate';
      const mimeType = (file.type || '').toLowerCase();

      if (file.size > MAX_UPLOAD_BYTES) {
        return bad(c, 'File too large. Maximum allowed size is 10MB.');
      }

      if (docType === 'HERO' || docType === 'APP_ICON' || docType === 'VENUE_IMAGE') {
        if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
          return bad(c, 'Image upload accepts image files only.');
        }
      } else if (!ALLOWED_DOC_MIME_TYPES.has(mimeType)) {
        return bad(c, 'Only PDF, DOC, and DOCX files are allowed.');
      }

      // Use user info from token for filename
      const user = c.get('user');
      const userName = user.email.split('@')[0];

      // Sanitize filename parts
      const safe = (s: string) => s.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 30);

      // Format: DOC_TYPE_PURPOSE_DATE_USER
      const ext = file.name.split('.').pop();
      const customFilename = `${safe(docType)}_${safe(purpose)}_${safe(date)}_${safe(userName)}.${ext}`;

      const { GoogleDriveService } = await import('./drive');
      const drive = new GoogleDriveService(c.env);
      const result = await drive.uploadFile(file, undefined, customFilename);

      const proxyUrl = `/api/images/${result.id}`;

      return ok(c, {
        url: proxyUrl,
        downloadUrl: result.webContentLink
      });
    } catch (err: any) {
      console.error('Upload error:', err);
      // Enhanced error handling for common upload issues
      return c.json({ error: err.message || 'Upload failed' }, 500);
    }
  });
}
