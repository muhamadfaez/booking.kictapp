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
}
export interface Booking {
  id: string;
  venueId: string;
  userId: string;
  userName: string;
  date: string; // YYYY-MM-DD
  session: SessionSlot;
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