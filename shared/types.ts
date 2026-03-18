export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
export type UserRole = 'USER' | 'ADMIN';
export type BookingStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type SessionSlot = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'FULL_DAY';
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}
export interface Venue {
  id: string;
  name: string;
  description: string;
  capacity: number;
  imageUrl: string;
  amenities: string[];
  location: string;
  isAvailable?: boolean;
  unavailableReason?: string;
}
export interface Booking {
  id: string;
  venueId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  date: string; // YYYY-MM-DD
  session?: SessionSlot;
  status: BookingStatus;
  createdAt: number;
  purpose: string;
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  programType?: 'STUDENT' | 'STAFF' | 'GUEST';
  documents?: {
    approvalLetterUrl?: string;
    approvalLetterDownloadUrl?: string;
    proposalUrl?: string;
    proposalDownloadUrl?: string;
  };
}
export type NotificationType =
  | 'BOOKING_CREATED'
  | 'BOOKING_APPROVED'
  | 'BOOKING_REJECTED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_UPDATED';
export interface Notification {
  id: string;
  userId: string;
  audienceRole?: UserRole;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: number;
  readAt?: number;
  bookingId?: string;
  venueId?: string;
  link?: string;
}
export type AuditAction =
  | 'AUTH_OTP_REQUESTED'
  | 'AUTH_SIGNIN'
  | 'BOOKING_CREATED'
  | 'BOOKING_APPROVED'
  | 'BOOKING_REJECTED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_BATCH_CREATED'
  | 'VENUE_CREATED'
  | 'VENUE_UPDATED'
  | 'VENUE_DELETED'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'SETTINGS_UPDATED';
export interface AuditTrailEntry {
  id: string;
  actorUserId: string;
  actorEmail: string;
  actorRole?: UserRole;
  action: AuditAction;
  summary: string;
  targetType: 'BOOKING' | 'VENUE' | 'USER' | 'SETTINGS' | 'AUTH';
  targetId?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
  createdAt: number;
}
export interface AppSettings {
  heroImageUrl?: string;
  appName?: string;
  appLabel?: string;
  appIconUrl?: string;
}
export interface Chat {
  id: string;
  title: string;
}
export interface ChatMessage {
  id: string;
  chatId: string;
  userId: string;
  text: string;
  ts: number;
}
