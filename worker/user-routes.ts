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
}