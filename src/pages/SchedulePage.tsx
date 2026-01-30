import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Venue, Booking } from '@shared/types';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { CalendarView } from '@/components/schedule/CalendarView';
import { Loader2 } from 'lucide-react';

export default function SchedulePage() {
    const { user } = useAuth();
    const [date, setDate] = useState<Date | undefined>(new Date());

    // Fetch Venues
    const { data: venues, isLoading: venuesLoading } = useQuery({
        queryKey: ['venues'],
        queryFn: () => api<Venue[]>('/api/venues')
    });

    // State for selected venues filter
    // Initialize with all venues once loaded
    const [selectedVenues, setSelectedVenues] = useState<string[]>([]);

    // Effect to select all venues by default when they load
    React.useEffect(() => {
        if (venues && selectedVenues.length === 0) {
            setSelectedVenues(venues.map(v => v.id));
        }
    }, [venues]);

    // Fetch Bookings for the selected date range
    // Ideally, we fetch a range (e.g., the whole month) to avoid refetching on every day click
    // For now, let's fetch all active bookings for simplicity or filter by a larger range in a real app
    const { data: bookings, isLoading: bookingsLoading } = useQuery({
        queryKey: ['bookings-schedule', date?.toISOString()], // In real app, maybe key by Month
        queryFn: () => api<Booking[]>('/api/bookings?status=APPROVED'), // Adjust API to filter by date if needed
    });

    const toggleVenue = (venueId: string) => {
        setSelectedVenues(prev =>
            prev.includes(venueId)
                ? prev.filter(id => id !== venueId)
                : [...prev, venueId]
        );
    };

    const filteredVenues = venues?.filter(v => selectedVenues.includes(v.id)) || [];

    if (venuesLoading) {
        return (
            <AppLayout container>
                <div className="h-[80vh] flex items-center justify-center">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout container>
            <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
                <header>
                    <h1 className="text-3xl font-bold tracking-tight">Schedule & Availability</h1>
                    <p className="text-muted-foreground">View facility availability and upcoming bookings.</p>
                </header>

                <div className="flex-1 overflow-hidden h-full">
                    {bookingsLoading ? (
                        <div className="flex items-center justify-center h-full bg-card rounded-lg border">
                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <CalendarView
                            date={date || new Date()}
                            setDate={(d) => setDate(d)}
                            venues={venues || []}
                            bookings={bookings || []}
                            currentUserRole={user?.role}
                            currentUserId={user?.id}
                            onVenueFilterChange={setSelectedVenues}
                        />
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
