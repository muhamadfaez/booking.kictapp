import type { User, Venue, Booking } from './types';
export const MOCK_USERS: User[] = [
  { 
    id: 'u1', 
    name: 'Alex Rivera', 
    email: 'alex@nexus.com', 
    role: 'USER',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex'
  },
  { 
    id: 'u2', 
    name: 'Sarah Chen', 
    email: 'sarah@nexus.com', 
    role: 'ADMIN',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah'
  }
];
export const MOCK_VENUES: Venue[] = [
  {
    id: 'v1',
    name: 'Skyline Boardroom',
    description: 'High-tech meeting room with panoramic city views.',
    capacity: 12,
    imageUrl: 'https://images.unsplash.com/photo-1431540015161-0bf868a2d407?auto=format&fit=crop&q=80&w=800',
    amenities: ['4K Projector', 'Video Conf', 'Whiteboard', 'Coffee Bar'],
    location: 'Floor 42, East Wing'
  },
  {
    id: 'v2',
    name: 'Innovation Hub',
    description: 'Collaborative space designed for brainstorming and agile teams.',
    capacity: 25,
    imageUrl: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&q=80&w=800',
    amenities: ['Flexible Seating', 'Smart Screen', 'Acoustic Panels'],
    location: 'Floor 10, West Wing'
  },
  {
    id: 'v3',
    name: 'Grand Assembly Hall',
    description: 'Large auditorium for town halls and guest speaker events.',
    capacity: 150,
    imageUrl: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&q=80&w=800',
    amenities: ['Stage', 'Surround Sound', 'Dimmable Lighting'],
    location: 'Ground Floor, North Atrium'
  }
];
export const MOCK_BOOKINGS: Booking[] = [
  {
    id: 'b1',
    venueId: 'v1',
    userId: 'u1',
    userName: 'Alex Rivera',
    date: '2024-05-20',
    session: 'MORNING',
    status: 'APPROVED',
    createdAt: Date.now() - 86400000,
    purpose: 'Quarterly Review'
  },
  {
    id: 'b2',
    venueId: 'v2',
    userId: 'u1',
    userName: 'Alex Rivera',
    date: '2024-05-22',
    session: 'AFTERNOON',
    status: 'PENDING',
    createdAt: Date.now() - 43200000,
    purpose: 'Team Retro'
  }
];