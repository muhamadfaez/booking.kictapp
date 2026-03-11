import { Hono } from "hono";
import type { Env } from './core-utils';
import { UserEntity, VenueEntity, BookingEntity } from "./entities";
import { ok, bad, notFound } from './core-utils';
import type { Booking, SessionSlot, AppSettings, BookingStatus } from "@shared/types";
import { verify } from 'hono/jwt';
import { getRecentSignIns } from './signin-tracker';

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
const ALLOWED_DOC_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

async function withBookingLock<T>(c: any, venueId: string, date: string, fn: () => Promise<T>): Promise<T> {
  const globalDO = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName('GlobalDurableObject'));
  const lockKey = `lock:booking:${venueId}:${date}`;
  const ownerToken = crypto.randomUUID();
  let acquired = false;

  for (let attempt = 0; attempt < BOOKING_LOCK_MAX_RETRIES; attempt++) {
    const now = Date.now();
    const doc = await globalDO.getDoc<{ token: string; expiresAt: number }>(lockKey);
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
    const doc = await globalDO.getDoc<{ token: string; expiresAt: number }>(lockKey);
    if (doc?.data?.token === ownerToken) {
      await globalDO.casPut(lockKey, doc.v, { token: 'released', expiresAt: 0 });
    }
  }
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
    const doc = await globalDO.getDoc<AppSettings>('settings:app');
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
      const doc = await globalDO.getDoc<AppSettings>('settings:app');
      const current = doc?.data ?? {};
      const version = doc?.v ?? 0;

      const res = await globalDO.casPut('settings:app', version, { ...current, heroImageUrl });
      if (res.ok) {
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
      const doc = await globalDO.getDoc<AppSettings>('settings:app');
      const current = doc?.data ?? {};
      const version = doc?.v ?? 0;
      const res = await globalDO.casPut('settings:app', version, { ...current, ...updates });
      if (res.ok) return ok(c, { ...current, ...updates });
    }
    return bad(c, 'Failed to update branding settings. Please retry.');
  });

  // VENUES (Public Read)
  app.get('/api/venues', async (c) => {
    await VenueEntity.ensureSeed(c.env);
    const list = await VenueEntity.list(c.env);
    return ok(c, list.items);
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
    return ok(c, await venue.getState());
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

    await venue.delete();
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
    return ok(c, await user.getState());
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
    return ok(c, await user.getState());
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

  app.post('/api/bookings', verifyAuthStrict, async (c) => {
    const body = await c.req.json() as Partial<Booking>;
    const user = c.get('user');
    const { venueId, date, session, startTime, endTime, purpose } = body;

    // Use userId from token, ignore body userId
    const userId = user.sub;
    const userName = user.email.split('@')[0]; // Simplify or fetch user details if needed

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
      const created = await withBookingLock(c, venueId, date, async () => {
        const available = await BookingEntity.checkAvailability(c.env, venueId, date, startTime, endTime, session as SessionSlot);
        if (!available) {
          throw new Error('This slot is already reserved or pending approval');
        }

        const newBooking: Booking = {
          id: crypto.randomUUID(),
          venueId,
          userId,
          userName, // TODO: Fetch real name from UserEntity if important
          date,
          session: session as SessionSlot,
          startTime,
          endTime,
          status: 'PENDING',
          createdAt: Date.now(),
          purpose,
          documents: body.documents
        };

        return BookingEntity.create(c.env, newBooking);
      });

      return ok(c, created);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create booking';
      return bad(c, message);
    }
  });

  app.post('/api/bookings/:id/status', verifyAuthStrict, verifyAdminStrict, async (c) => {
    const id = c.req.param('id');
    const { status } = await c.req.json() as { status: string };
    const booking = new BookingEntity(c.env, id);
    if (!await booking.exists()) return notFound(c, 'Booking not found');

    // Privacy & Cleanup: If rejected, delete associated documents
    if (status === 'REJECTED') {
      const bookingData = await booking.getState();
      if (bookingData.documents) {
        try {
          const { GoogleDriveService } = await import('./drive');
          const drive = new GoogleDriveService(c.env);

          const docUrls = Object.values(bookingData.documents).filter(url => typeof url === 'string') as string[];

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
    return ok(c, await booking.getState());
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

    // Only allow cancellation of PENDING bookings
    if (bookingData.status !== 'PENDING') {
      return bad(c, 'Only pending bookings can be cancelled');
    }

    await booking.patch({ status: 'CANCELLED' });
    return ok(c, await booking.getState());
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

      if (docType === 'HERO' || docType === 'APP_ICON') {
        if (!mimeType.startsWith('image/')) {
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
