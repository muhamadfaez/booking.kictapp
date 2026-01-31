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
  XCircle,
  MapPin,
  Building2,
  Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';

export default function MyBookingsPage() {
  const { user } = useAuth();

  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ['my-bookings', user?.id],
    queryFn: () => api<Booking[]>(`/api/bookings?userId=${user?.id}`),
    enabled: !!user?.id
  });

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return {
          icon: CheckCircle2,
          className: 'badge-success',
          label: 'Approved'
        };
      case 'PENDING':
        return {
          icon: Timer,
          className: 'badge-warning',
          label: 'Pending'
        };
      case 'REJECTED':
      case 'CANCELLED':
        return {
          icon: XCircle,
          className: 'badge-error',
          label: status === 'REJECTED' ? 'Rejected' : 'Cancelled'
        };
      default:
        return { icon: Clock, className: '', label: status };
    }
  };

  const pendingCount = bookings?.filter(b => b.status === 'PENDING').length ?? 0;
  const approvedCount = bookings?.filter(b => b.status === 'APPROVED').length ?? 0;
  const totalCount = bookings?.length ?? 0;

  return (
    <AppLayout container>
      <div className="space-y-8">
        {/* Header */}
        <header className="relative overflow-hidden rounded-2xl bg-gradient-subtle p-8 border border-border/50">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-primary opacity-5 blur-3xl" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-primary">
                <CalendarDays className="w-5 h-5" />
                <span className="text-sm font-medium uppercase tracking-wider">Reservations</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                My Bookings
              </h1>
              <p className="text-muted-foreground">
                View and manage your reservation history
              </p>
            </div>

            {/* Stats */}
            <div className="flex gap-4">
              <div className="text-center px-6 py-3 rounded-xl bg-card border border-border/50">
                <p className="text-2xl font-bold">{totalCount}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="text-center px-6 py-3 rounded-xl bg-card border border-border/50">
                <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div className="text-center px-6 py-3 rounded-xl bg-card border border-border/50">
                <p className="text-2xl font-bold text-emerald-600">{approvedCount}</p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
            </div>
          </div>
        </header>

        {/* Booking Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {bookingsLoading ? (
            Array.from({ length: 8 }, (_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-5 space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-6 w-20" />
                </CardContent>
              </Card>
            ))
          ) : bookings?.length === 0 ? (
            <Card className="col-span-full py-20 border-dashed border-2 bg-muted/20">
              <CardContent className="flex flex-col items-center justify-center text-muted-foreground space-y-4">
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                  <Clock className="w-10 h-10 opacity-40" />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-xl font-semibold">No bookings yet</p>
                  <p className="text-sm max-w-sm">
                    Your reservations will appear here once you make a booking from the dashboard.
                  </p>
                </div>
                <Button className="btn-gradient mt-4">
                  <Building2 className="mr-2 w-4 h-4" />
                  Explore Venues
                </Button>
              </CardContent>
            </Card>
          ) : (
            bookings?.map((booking, index) => {
              const statusConfig = getStatusConfig(booking.status);
              const StatusIcon = statusConfig.icon;

              return (
                <Card
                  key={booking.id}
                  className="group overflow-hidden border hover:shadow-lg transition-all duration-300 hover:border-border animate-fade-in"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <CardHeader className="p-5 pb-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {format(new Date(booking.date), 'EEEE')}
                        </p>
                        <p className="text-lg font-bold text-primary">
                          {format(new Date(booking.date), 'MMM dd, yyyy')}
                        </p>
                      </div>
                      <Badge className={`${statusConfig.className} text-[10px] font-bold uppercase px-2.5 py-1`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusConfig.label}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 pt-0 space-y-4">
                    <CardTitle className="text-base leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                      {booking.purpose}
                    </CardTitle>

                    <div className="space-y-2 pt-2 border-t border-border/50">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span className="font-medium">
                          {booking.startTime && booking.endTime
                            ? `${booking.startTime} - ${booking.endTime}`
                            : booking.session ? booking.session.replace('_', ' ') : 'N/A'
                          }
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
}