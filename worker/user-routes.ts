import { Hono } from "hono";
import type { Env } from './core-utils';
import { UserEntity, VenueEntity, BookingEntity } from "./entities";
import { ok, bad, notFound, isStr } from './core-utils';
import type { Booking, SessionSlot } from "@shared/types";

export function userRoutes(app: Hono<{ Bindings: Env }>) {
  // SEED INITIAL DATA
  app.get('/api/init', async (c) => {
    await UserEntity.ensureSeed(c.env);
    await VenueEntity.ensureSeed(c.env);
    await BookingEntity.ensureSeed(c.env);
    return ok(c, "Seeded");
  });

  // VENUES
  app.get('/api/venues', async (c) => {
    await VenueEntity.ensureSeed(c.env);
    const list = await VenueEntity.list(c.env);
    return ok(c, list.items);
  });

  app.post('/api/venues', async (c) => {
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

  app.put('/api/venues/:id', async (c) => {
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

  app.delete('/api/venues/:id', async (c) => {
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
  app.get('/api/bookings', async (c) => {
    await BookingEntity.ensureSeed(c.env);
    const userId = c.req.query('userId');
    const list = await BookingEntity.list(c.env);
    if (userId) {
      return ok(c, list.items.filter(b => b.userId === userId));
    }
    return ok(c, list.items);
  });

  app.post('/api/bookings', async (c) => {
    const body = await c.req.json() as Partial<Booking>;
    const { venueId, userId, date, session, startTime, endTime, purpose, userName } = body;

    // Validation: Require basic fields + either session OR (startTime AND endTime)
    if (!venueId || !userId || !date || (!session && (!startTime || !endTime)) || !purpose || !userName) {
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
      userName,
      date,
      session: session as SessionSlot, // Optional now
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

  app.post('/api/bookings/:id/status', async (c) => {
    const id = c.req.param('id');
    const { status } = await c.req.json() as { status: string };
    const booking = new BookingEntity(c.env, id);
    if (!await booking.exists()) return notFound(c, 'Booking not found');
    await booking.patch({ status: status as any });
    return ok(c, await booking.getState());
  });

  app.delete('/api/bookings/:id', async (c) => {
    const id = c.req.param('id');
    const { userId } = c.req.query();

    const booking = new BookingEntity(c.env, id);
    if (!await booking.exists()) return notFound(c, 'Booking not found');

    const bookingData = await booking.getState();

    // Only allow cancellation if user owns the booking or is admin
    if (userId && bookingData.userId !== userId) {
      return bad(c, 'Unauthorized: You can only cancel your own bookings');
    }

    // Only allow cancellation of PENDING bookings
    if (bookingData.status !== 'PENDING') {
      return bad(c, 'Only pending bookings can be cancelled');
    }

    // Update status to CANCELLED instead of deleting
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
  app.post('/api/upload', async (c) => {
    try {
      const body = await c.req.parseBody();
      const file = body['file'];

      if (!(file instanceof File)) {
        return bad(c, 'No file provided');
      }

      const docType = body['docType'] as string || 'DOC';
      const purpose = body['purpose'] as string || 'UnknownPurpose';
      const date = body['date'] as string || 'UnknownDate';
      const userName = body['userName'] as string || 'UnknownUser';

      // Sanitize filename parts
      const safe = (s: string) => s.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 30);

      // Format: DOC_TYPE_PURPOSE_DATE_USER
      const ext = file.name.split('.').pop();
      const customFilename = `${safe(docType)}_${safe(purpose)}_${safe(date)}_${safe(userName)}.${ext}`;

      const { GoogleDriveService } = await import('./drive');
      const drive = new GoogleDriveService(c.env);
      const result = await drive.uploadFile(file, undefined, customFilename);

      // Return local proxy URL instead of Google URL
      // This is robust against 3rd party cookie blocking/permissions
      const proxyUrl = `/api/images/${result.id}`;

      return ok(c, {
        url: proxyUrl,
        downloadUrl: result.webContentLink
      });
    } catch (err: any) {
      console.error('Upload error:', err);
      return c.json({ error: err.message }, 500);
    }
  });
}