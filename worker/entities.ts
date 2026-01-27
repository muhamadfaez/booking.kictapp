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
  static async checkAvailability(env: any, venueId: string, date: string, session: SessionSlot): Promise<boolean> {
    const { items } = await this.list(env);
    const conflict = items.find(b => 
      b.venueId === venueId && 
      b.date === date && 
      b.session === session && 
      (b.status === 'APPROVED' || b.status === 'PENDING')
    );
    return !conflict;
  }
}