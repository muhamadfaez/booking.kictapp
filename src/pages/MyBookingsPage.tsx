import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { api } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import type { Booking } from '@shared/types';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent 
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  CalendarDays, 
  Clock, 
  CheckCircle2, 
  Timer, 
  XCircle 
} from 'lucide-react';
import { format } from 'date-fns';
export default function MyBookingsPage() {
  const { user } = useAuth();
  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ['my-bookings', user?.id],
    queryFn: () => api<Booking[]>(`/api/bookings?userId=${user?.id}`),
    enabled: !!user?.id
  });
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED': 
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'PENDING': 
        return <Timer className="w-4 h-4 text-amber-500" />;
      case 'REJECTED':
      case 'CANCELLED':
        return <XCircle className="w-4 h-4 text-destructive" />;
      default: 
        return null;
    }
  };
  return (
    <AppLayout container>
      <div className="space-y-10">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="w-8 h-8 text-primary" />
            My Bookings
          </h1>
          <p className="text-muted-foreground">View and manage your reservations history</p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {bookingsLoading ? (
            // 6 skeleton placeholders for loading state
            Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))
          ) : bookings?.length === 0 ? (
            <Card className="col-span-full py-20 border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center text-muted-foreground space-y-3">
                <Clock className="w-12 h-12 opacity-40" />
                <div className="text-center">
                  <p className="text-xl font-medium">No bookings yet</p>
                  <p className="text-sm">Your reservations will appear here once you make a booking.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            bookings?.map((booking) => (
              <Card key={booking.id} className="relative overflow-hidden hover:shadow-md transition-all">
                <CardHeader className="p-6 pb-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {format(new Date(booking.date), 'MMM dd, yyyy')}
                      </p>
                      <CardTitle className="text-lg leading-tight line-clamp-2">{booking.purpose}</CardTitle>
                    </div>
                    <Badge 
                      variant="outline" 
                      className="flex items-center gap-1 text-xs px-2.5 h-6"
                    >
                      {getStatusIcon(booking.status)}
                      {booking.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6 pt-0 pb-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>{booking.session.replace('_', ' ')}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}