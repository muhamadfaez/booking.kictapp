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
    const { name, location, capacity, description, imageUrl } = body;

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
      amenities: []
    };

    const created = await VenueEntity.create(c.env, newVenue);
    return ok(c, created);
  });

  app.put('/api/venues/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json() as any;

    const venue = new VenueEntity(c.env, id);
    if (!await venue.exists()) return notFound(c, 'Venue not found');

    const { name, location, capacity, description, imageUrl } = body;
    const updates: any = {};

    if (name !== undefined) updates.name = name;
    if (location !== undefined) updates.location = location;
    if (capacity !== undefined) updates.capacity = Number(capacity);
    if (description !== undefined) updates.description = description;
    if (imageUrl !== undefined) updates.imageUrl = imageUrl;

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
    const { venueId, userId, date, session, purpose, userName } = body;
    if (!venueId || !userId || !date || !session || !purpose || !userName) {
      return bad(c, 'Missing required booking fields');
    }
    // Atomic availability check (simplified for Phase 1)
    const available = await BookingEntity.checkAvailability(c.env, venueId, date, session as SessionSlot);
    if (!available) {
      return bad(c, 'This slot is already reserved or pending approval');
    }
    const newBooking: Booking = {
      id: crypto.randomUUID(),
      venueId,
      userId,
      userName,
      date,
      session: session as SessionSlot,
      status: 'PENDING',
      createdAt: Date.now(),
      purpose
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

  // UPLOADS
  app.post('/api/upload', async (c) => {
    try {
      const body = await c.req.parseBody();
      const file = body['file'];

      if (!(file instanceof File)) {
        return bad(c, 'No file provided');
      }

      const { GoogleDriveService } = await import('./drive');
      const drive = new GoogleDriveService(c.env);
      const result = await drive.uploadFile(file);

      return ok(c, { url: result.webViewLink, fileId: result.id });
    } catch (err: any) {
      console.error('Upload error:', err);
      return bad(c, `Upload failed: ${err.message}`);
    }
  });
}