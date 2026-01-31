import { IndexedEntity } from "./core-utils";
import type { User, Venue, Booking, SessionSlot } from "@shared/types";
import { MOCK_USERS, MOCK_VENUES, MOCK_BOOKINGS } from "@shared/mock-data";
export class UserEntity extends IndexedEntity<User> {
  static readonly entityName = "user";
  static readonly indexName = "users";
  static readonly initialState: User = { id: "", name: "", email: "", role: "USER" };
  static seedData = MOCK_USERS;
}
export class VenueEntity extends IndexedEntity<Venue> {
  static readonly entityName = "venue";
  static readonly indexName = "venues";
  static readonly initialState: Venue = {
    id: "", name: "", description: "", capacity: 0, imageUrl: "", amenities: [], location: ""
  };
  static seedData = MOCK_VENUES;
  // Stored in a separate key pattern: venue_avail:{venueId}:{date}
  // This isn't directly in state to avoid massive state objects. 
  // For Phase 1 simplified: we'll check BookingEntity index instead.
}
export class BookingEntity extends IndexedEntity<Booking> {
  static readonly entityName = "booking";
  static readonly indexName = "bookings";
  static readonly initialState: Booking = {
    id: "", venueId: "", userId: "", userName: "", date: "",
    session: "MORNING", status: "PENDING", createdAt: 0, purpose: ""
  };
  static seedData = MOCK_BOOKINGS;
  static async checkAvailability(env: any, venueId: string, date: string, startTime?: string, endTime?: string, session?: SessionSlot): Promise<boolean> {
    const { items } = await this.list(env);

    // Time conversion helper
    const toMins = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    // Range helper
    const getRange = (b: { startTime?: string, endTime?: string, session?: SessionSlot }): [number, number] | null => {
      if (b.startTime && b.endTime) {
        return [toMins(b.startTime), toMins(b.endTime)];
      }
      if (b.session) {
        switch (b.session) {
          case 'MORNING': return [480, 720]; // 08:00 - 12:00
          case 'AFTERNOON': return [780, 1020]; // 13:00 - 17:00
          case 'EVENING': return [1080, 1320]; // 18:00 - 22:00
          case 'FULL_DAY': return [480, 1320]; // 08:00 - 22:00
        }
      }
      return null;
    };

    // Requested Range
    const requestedRange = getRange({ startTime, endTime, session });
    if (!requestedRange) return false; // Invalid request

    const [reqStart, reqEnd] = requestedRange;

    const conflict = items.find(b => {
      // Must match venue, date and be active
      if (b.venueId !== venueId || b.date !== date) return false;
      if (b.status === 'CANCELLED' || b.status === 'REJECTED') return false;

      // Check overlap
      const existingRange = getRange(b);
      if (!existingRange) return false; // Should not happen for valid bookings

      const [existStart, existEnd] = existingRange;

      // Overlap logic: (StartA < EndB) and (EndA > StartB)
      return (reqStart < existEnd) && (reqEnd > existStart);
    });

    return !conflict;
  }
}