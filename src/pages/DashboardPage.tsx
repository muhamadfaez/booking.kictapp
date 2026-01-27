import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { VenueCard } from '@/components/booking/VenueCard';
import { BookingWizard } from '@/components/booking/BookingWizard';
import { api } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import type { Venue, Booking } from '@shared/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, Clock, CheckCircle2, Timer, XCircle } from 'lucide-react';
import { format } from 'date-fns';
export default function DashboardPage() {
  const { user } = useAuth();
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const { data: venues, isLoading: venuesLoading } = useQuery({
    queryKey: ['venues'],
    queryFn: () => api<Venue[]>('/api/venues')
  });
  const { data: bookings, isLoading: bookingsLoading, refetch: refetchBookings } = useQuery({
    queryKey: ['my-bookings', user?.id],
    queryFn: () => api<Booking[]>(`/api/bookings?userId=${user?.id}`),
    enabled: !!user?.id
  });
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'PENDING': return <Timer className="w-4 h-4 text-amber-500" />;
      case 'REJECTED': return <XCircle className="w-4 h-4 text-destructive" />;
      default: return null;
    }
  };
  return (
    <AppLayout container>
      <div className="space-y-10">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user?.name}</h1>
            <p className="text-muted-foreground">Manage your workspace reservations and explore facilities.</p>
          </div>
        </header>
        <section className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            My Recent Bookings
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bookingsLoading ? (
              [1, 2].map(i => <Skeleton key={i} className="h-32 w-full" />)
            ) : bookings?.length === 0 ? (
              <Card className="col-span-full py-10 border-dashed">
                <CardContent className="flex flex-col items-center justify-center text-muted-foreground">
                  <Clock className="w-10 h-10 mb-2 opacity-20" />
                  <p>No active bookings found.</p>
                </CardContent>
              </Card>
            ) : (
              bookings?.slice(0, 3).map(booking => (
                <Card key={booking.id} className="relative overflow-hidden">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium text-muted-foreground">{booking.date}</p>
                        <CardTitle className="text-sm font-bold">{booking.purpose}</CardTitle>
                      </div>
                      <Badge variant="outline" className="flex items-center gap-1 text-[10px] px-2">
                        {getStatusIcon(booking.status)}
                        {booking.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {booking.session}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </section>
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Available Venues</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {venuesLoading ? (
              [1, 2, 3].map(i => <Skeleton key={i} className="h-[300px] w-full" />)
            ) : (
              venues?.map(venue => (
                <VenueCard 
                  key={venue.id} 
                  venue={venue} 
                  onBook={(v) => setSelectedVenue(v)} 
                />
              ))
            )}
          </div>
        </section>
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