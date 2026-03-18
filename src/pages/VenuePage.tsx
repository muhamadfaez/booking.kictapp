import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { api } from '@/lib/api-client';
import type { Venue, Booking } from '@shared/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarView } from '@/components/schedule/CalendarView';
import { Building2, Loader2, MapPin, Users, CalendarDays, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/use-page-title';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function VenuePage() {
  usePageTitle('Venues');
  const { user } = useAuth();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedVenueId, setSelectedVenueId] = useState<string>('');

  const { data: venues = [], isLoading: venuesLoading } = useQuery({
    queryKey: ['venues'],
    queryFn: () => api<Venue[]>('/api/venues'),
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
    staleTime: 0
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
      <div className="space-y-8">
        <header className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-subtle p-8">
          <div className="absolute right-0 top-0 h-64 w-64 bg-gradient-primary opacity-5 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <CalendarDays className="h-5 w-5" />
                <span className="text-sm font-medium uppercase tracking-wider">Realtime Venue Calendar</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Venue Availability</h1>
              <p className="max-w-2xl text-muted-foreground">
                Select a venue from the directory to inspect its live booking calendar without leaving the page.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:w-auto">
              <Card className="border-border/50 bg-background/80 shadow-sm">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{venues.length}</p>
                  <p className="text-xs text-muted-foreground">Total Venues</p>
                </CardContent>
              </Card>
              <Card className="border-border/50 bg-background/80 shadow-sm">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-600">
                    {venues.filter((venue) => venue.isAvailable !== false).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Open Now</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </header>

        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-muted/30 px-6 py-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl font-bold">Choose Venue</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Use the selector to swap the calendar context instantly.
                </p>
              </div>

              <div className="w-full max-w-md">
                {venuesLoading ? (
                  <Skeleton className="h-11 w-full rounded-xl" />
                ) : (
                  <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
                    <SelectTrigger className="h-12 rounded-xl border-border/60 bg-background">
                      <SelectValue placeholder="Select a venue" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {venues.map((venue) => (
                        <SelectItem key={venue.id} value={venue.id} className="rounded-lg">
                          {venue.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 p-6">
            {selectedVenue ? (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                <Card className="border-border/50 bg-background/70 shadow-none">
                  <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <Building2 className="h-6 w-6" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold">{selectedVenue.name}</h2>
                          <p className="text-sm text-muted-foreground">Live venue schedule overview</p>
                        </div>
                      </div>

                      <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary/70" />
                          <span>{selectedVenue.location}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary/70" />
                          <span>Capacity: {selectedVenue.capacity}</span>
                        </div>
                      </div>

                      <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                        {selectedVenue.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-end">
                      <Badge variant={selectedVenue.isAvailable === false ? 'destructive' : 'secondary'} className="px-3 py-1">
                        {selectedVenue.isAvailable === false ? 'Unavailable' : 'Available'}
                      </Badge>
                      {selectedVenue.isAvailable === false && selectedVenue.unavailableReason ? (
                        <p className="max-w-[220px] text-right text-xs text-destructive">
                          {selectedVenue.unavailableReason}
                        </p>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/50 bg-background/70 shadow-none">
                  <CardContent className="flex h-full flex-col justify-center gap-2 p-5">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Current View
                    </span>
                    <div className="text-3xl font-black tracking-tight">
                      {date?.toLocaleString('default', { month: 'short' })}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Review occupancy in day, week, month, or year mode directly in the calendar.
                    </p>
                  </CardContent>
                </Card>
              </div>
            ) : null}

            <div className="min-h-[520px] overflow-hidden rounded-2xl border bg-card lg:min-h-[600px]">
              {!selectedVenue || occupancyLoading ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                  Loading calendar...
                </div>
              ) : (
                <CalendarView
                  date={date || new Date()}
                  setDate={(nextDate) => setDate(nextDate)}
                  venues={[selectedVenue]}
                  bookings={occupancyBookings}
                  currentUserRole={user?.role}
                  currentUserId={user?.id}
                  hideBookingOwner
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
