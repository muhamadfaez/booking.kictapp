import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { VenueCard } from '@/components/booking/VenueCard';
import { BookingWizard } from '@/components/booking/BookingWizard';
import { api } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import type { Venue, Booking } from '@shared/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2 } from 'lucide-react';
import { usePageTitle } from '@/hooks/use-page-title';

export default function DashboardPage() {
  usePageTitle('Dashboard');
  const { user } = useAuth();
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const { data: venues, isLoading: venuesLoading } = useQuery({
    queryKey: ['venues'],
    queryFn: () => api<Venue[]>('/api/venues'),
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
    staleTime: 0
  });
  const { data: bookings = [], refetch: refetchBookings } = useQuery({
    queryKey: ['my-bookings', user?.id],
    queryFn: () => api<Booking[]>(`/api/bookings?userId=${user?.id}`),
    enabled: !!user?.id,
    refetchOnWindowFocus: true,
    refetchInterval: user?.id ? 15000 : false,
    staleTime: 0
  });

  const pendingCount = bookings.filter((b) => b.status === 'PENDING').length;
  const approvedCount = bookings.filter((b) => b.status === 'APPROVED').length;
  const totalCount = bookings.length;
  const displayVenues = venues ?? [];

  return (
    <AppLayout container>
      <div className="space-y-8">
        <header className="relative overflow-hidden rounded-2xl bg-gradient-subtle p-8 border border-border/50">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-primary opacity-5 blur-3xl" />
          <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-primary">
                <Building2 className="w-5 h-5" />
                <span className="text-sm font-medium uppercase tracking-wider">Dashboard</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Welcome back, {user?.name}</h1>
              <p className="text-muted-foreground">Manage your workspace reservations and explore facilities.</p>
            </div>

            <div className="grid grid-cols-3 gap-3 w-full md:w-auto">
              <Card className="border-border/50">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{totalCount}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{approvedCount}</p>
                  <p className="text-xs text-muted-foreground">Approved</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </header>
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="px-6 py-5 border-b border-border/50 bg-muted/30">
            <CardTitle className="text-xl font-bold">Available Venues</CardTitle>
            <CardDescription>List of venues with current availability information.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {venuesLoading ? (
                [1, 2, 3].map(i => <Skeleton key={i} className="h-[300px] w-full" />)
              ) : (
                displayVenues.map(venue => (
                  <VenueCard
                    key={venue.id}
                    venue={venue}
                    onBook={(v) => setSelectedVenue(v)}
                    disabled={venue.isAvailable === false}
                    disabledReason={venue.unavailableReason || 'Closed for maintenance'}
                  />
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <BookingWizard 
        venue={selectedVenue}
        isOpen={!!selectedVenue}
        onClose={() => setSelectedVenue(null)}
        onSuccess={refetchBookings}
      />
    </AppLayout>
  );
}
