import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { api } from '@/lib/api-client';
import type { Venue, Booking } from '@shared/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarView } from '@/components/schedule/CalendarView';
import { Building2, Loader2, MapPin, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/use-page-title';

export default function VenuePage() {
  usePageTitle('Venues');
  const { user } = useAuth();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedVenueId, setSelectedVenueId] = useState<string>('');

  const { data: venues = [], isLoading: venuesLoading } = useQuery({
    queryKey: ['venues'],
    queryFn: () => api<Venue[]>('/api/venues')
  });

  const { data: occupancyBookings = [], isLoading: occupancyLoading } = useQuery({
    queryKey: ['venue-occupancy-calendar'],
    queryFn: () => api<Booking[]>('/api/bookings/occupancy'),
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
    staleTime: 5000
  });

  useEffect(() => {
    if (!selectedVenueId && venues.length > 0) {
      setSelectedVenueId(venues[0].id);
    }
  }, [selectedVenueId, venues]);

  const selectedVenue = useMemo(
    () => venues.find((v) => v.id === selectedVenueId) || null,
    [venues, selectedVenueId]
  );

  return (
    <AppLayout container>
      <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
        <header className="shrink-0">
          <h1 className="text-3xl font-bold tracking-tight">Venue</h1>
          <p className="text-muted-foreground">
            Choose a venue to view its realtime booking calendar.
          </p>
        </header>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-6">
          <section className="min-h-0 rounded-lg border bg-card overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b bg-muted/30 shrink-0">
              <h2 className="text-base font-semibold">Venue List</h2>
            </div>
            <div className="p-3 space-y-3 overflow-y-auto">
              {venuesLoading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4 space-y-2">
                      <Skeleton className="h-5 w-2/3" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-1/3" />
                    </CardContent>
                  </Card>
                ))
              ) : (
                venues.map((venue) => (
                  <Card
                    key={venue.id}
                    onClick={() => setSelectedVenueId(venue.id)}
                    className={`cursor-pointer transition-all ${selectedVenueId === venue.id ? 'ring-2 ring-primary border-primary/40' : 'hover:border-primary/30'}`}
                  >
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base">{venue.name}</CardTitle>
                        <Badge variant={venue.isAvailable === false ? 'destructive' : 'secondary'}>
                          {venue.isAvailable === false ? 'Unavailable' : 'Available'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {venue.location}
                      </p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        Capacity: {venue.capacity}
                      </p>
                      {venue.isAvailable === false && venue.unavailableReason && (
                        <p className="text-xs text-destructive">Reason: {venue.unavailableReason}</p>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </section>

          <section className="min-h-0 overflow-hidden space-y-3 flex flex-col">
            <h2 className="text-lg font-semibold shrink-0">
              {selectedVenue ? `${selectedVenue.name} Calendar` : 'Venue Calendar'}
            </h2>
            <div className="flex-1 min-h-[420px] overflow-hidden rounded-lg border bg-card">
              {!selectedVenue || occupancyLoading ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  Loading calendar...
                </div>
              ) : (
                <CalendarView
                  date={date || new Date()}
                  setDate={(d) => setDate(d)}
                  venues={[selectedVenue]}
                  bookings={occupancyBookings}
                  currentUserRole={user?.role}
                  currentUserId={user?.id}
                />
              )}
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
