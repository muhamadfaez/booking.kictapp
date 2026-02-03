import { Hono } from "hono";
import type { Env } from './core-utils';
import { UserEntity, VenueEntity, BookingEntity } from "./entities";
import { ok, bad, notFound, isStr, verifyAuth, verifyAdmin } from './core-utils';
import type { Booking, SessionSlot } from "@shared/types";

export function userRoutes(app: Hono<{ Bindings: Env, Variables: { user: any } }>) {
  // SEED INITIAL DATA (Admin Only)
  app.get('/api/init', verifyAuth, verifyAdmin, async (c) => {
    await UserEntity.ensureSeed(c.env);
    await VenueEntity.ensureSeed(c.env);
    await BookingEntity.ensureSeed(c.env);
    return ok(c, "Seeded");
  });

  // VENUES (Public Read)
  app.get('/api/venues', async (c) => {
    await VenueEntity.ensureSeed(c.env);
    const list = await VenueEntity.list(c.env);
    return ok(c, list.items);
  });

  app.post('/api/venues', verifyAuth, verifyAdmin, async (c) => {
    const body = await c.req.json() as any;
    const { name, location, capacity, description, imageUrl, amenities } = body;

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
      amenities: amenities || []
    };

    const created = await VenueEntity.create(c.env, newVenue);
    return ok(c, created);
  });

  app.put('/api/venues/:id', verifyAuth, verifyAdmin, async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json() as any;

    const venue = new VenueEntity(c.env, id);
    if (!await venue.exists()) return notFound(c, 'Venue not found');

    const { name, location, capacity, description, imageUrl, amenities } = body;
    const updates: any = {};

    if (name !== undefined) updates.name = name;
    if (location !== undefined) updates.location = location;
    if (capacity !== undefined) updates.capacity = Number(capacity);
    if (description !== undefined) updates.description = description;
    if (imageUrl !== undefined) updates.imageUrl = imageUrl;
    if (amenities !== undefined) updates.amenities = amenities;

    await venue.patch(updates);
    return ok(c, await venue.getState());
  });

  app.delete('/api/venues/:id', verifyAuth, verifyAdmin, async (c) => {
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
  app.get('/api/bookings', verifyAuth, async (c) => {
    await BookingEntity.ensureSeed(c.env);
    const user = c.get('user');

    // If admin, allow viewing all or filtering by userId query
    // If user, force filtering by their own ID

    const list = await BookingEntity.list(c.env);

    if (user.role === 'ADMIN') {
      const userIdParam = c.req.query('userId');
      if (userIdParam) {
        return ok(c, list.items.filter(b => b.userId === userIdParam));
      }
      return ok(c, list.items);
    } else {
      // Regular user: Only see own bookings
      return ok(c, list.items.filter(b => b.userId === user.sub));
    }
  });

  app.post('/api/bookings', verifyAuth, async (c) => {
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

    // Atomic availability check
    const available = await BookingEntity.checkAvailability(c.env, venueId, date, startTime, endTime, session as SessionSlot);
    if (!available) {
      return bad(c, 'This slot is already reserved or pending approval');
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

    const created = await BookingEntity.create(c.env, newBooking);
    return ok(c, created);
  });

  app.post('/api/bookings/:id/status', verifyAuth, verifyAdmin, async (c) => {
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

  app.delete('/api/bookings/:id', verifyAuth, async (c) => {
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
  app.post('/api/upload', verifyAuth, async (c) => {
    try {
      const body = await c.req.parseBody();
      const file = body['file'];

      if (!(file instanceof File)) {
        return bad(c, 'No file provided');
      }

      const docType = body['docType'] as string || 'DOC';
      const purpose = body['purpose'] as string || 'UnknownPurpose';
      const date = body['date'] as string || 'UnknownDate';

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