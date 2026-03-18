import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { api } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import type { Booking, Venue } from '@shared/types';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageTitle } from '@/hooks/use-page-title';
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  Timer,
  XCircle
} from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CancelBookingDialog } from '@/components/booking/CancelBookingDialog';

export default function MyBookingsPage() {
  usePageTitle('My Bookings');
  const { user } = useAuth();
  const [selectedBooking, setSelectedBooking] = React.useState<Booking | null>(null);
  const [bookingToCancel, setBookingToCancel] = React.useState<Booking | null>(null);
  const parseLocalDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ['my-bookings', user?.id],
    queryFn: () => api<Booking[]>(`/api/bookings?userId=${user?.id}`),
    enabled: !!user?.id,
    refetchOnWindowFocus: true,
    refetchInterval: user?.id ? 15000 : false,
    staleTime: 0
  });
  const { data: venues = [] } = useQuery({
    queryKey: ['venues'],
    queryFn: () => api<Venue[]>('/api/venues')
  });
  const sortedBookings = React.useMemo(
    () => [...(bookings ?? [])].sort((a, b) => b.createdAt - a.createdAt),
    [bookings]
  );
  const venueMap = React.useMemo(
    () => Object.fromEntries(venues.map((venue) => [venue.id, venue.name])),
    [venues]
  );

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

          </div>
        </header>

        {/* Recent Bookings */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            My Recent Bookings
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bookingsLoading ? (
              [1, 2].map(i => <Skeleton key={i} className="h-32 w-full" />)
            ) : sortedBookings.length === 0 ? (
              <Card className="col-span-full py-10 border-dashed">
                <CardContent className="flex flex-col items-center justify-center text-muted-foreground">
                  <Clock className="w-10 h-10 mb-2 opacity-20" />
                  <p>No active bookings found.</p>
                </CardContent>
              </Card>
            ) : (
              sortedBookings.map((booking) => {
                const statusConfig = getStatusConfig(booking.status);
                const StatusIcon = statusConfig.icon;
                return (
                  <Card
                    key={`recent-${booking.id}`}
                    className="relative overflow-hidden cursor-pointer hover:shadow-md transition-all"
                    onClick={() => setSelectedBooking(booking)}
                  >
                    <CardHeader className="p-4 pb-2">
                      <div className="flex justify-between items-start">
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-muted-foreground">{booking.date}</p>
                          <CardTitle className="text-sm font-bold">{booking.purpose}</CardTitle>
                        </div>
                        <Badge className={`${statusConfig.className} text-[10px] font-bold uppercase px-2.5 py-1`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusConfig.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {booking.startTime && booking.endTime
                          ? `${booking.startTime} - ${booking.endTime}`
                          : booking.session ? booking.session.replace('_', ' ') : 'N/A'}
                      </div>
                      {booking.status === 'PENDING' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 w-full"
                          onClick={(event) => {
                            event.stopPropagation();
                            setBookingToCancel(booking);
                          }}
                        >
                          Cancel Booking
                        </Button>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </section>

      </div>

      <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
            <DialogDescription>
              Full information for your selected booking.
            </DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">{format(parseLocalDate(selectedBooking.date), 'MMM dd, yyyy')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-medium">{selectedBooking.status}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Time</p>
                  <p className="font-medium">
                    {selectedBooking.startTime && selectedBooking.endTime
                      ? `${selectedBooking.startTime} - ${selectedBooking.endTime}`
                      : selectedBooking.session ? selectedBooking.session.replace('_', ' ') : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Venue</p>
                  <p className="font-medium">
                    {venues.find((v) => v.id === selectedBooking.venueId)?.name || selectedBooking.venueId}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-muted-foreground">Purpose</p>
                <p className="font-medium">{selectedBooking.purpose || '-'}</p>
              </div>

              {selectedBooking.programType && (
                <div>
                  <p className="text-muted-foreground">Program Type</p>
                  <p className="font-medium">{selectedBooking.programType}</p>
                </div>
              )}

              {selectedBooking.documents && (
                <div className="space-y-1">
                  <p className="text-muted-foreground">Documents</p>
                  <div className="flex flex-col gap-1">
                    {selectedBooking.documents.proposalDownloadUrl && (
                      <a className="text-primary underline" href={selectedBooking.documents.proposalDownloadUrl} target="_blank" rel="noreferrer">
                        View Proposal
                      </a>
                    )}
                    {selectedBooking.documents.approvalLetterDownloadUrl && (
                      <a className="text-primary underline" href={selectedBooking.documents.approvalLetterDownloadUrl} target="_blank" rel="noreferrer">
                        View Approval Letter
                      </a>
                    )}
                  </div>
                </div>
              )}

              {selectedBooking.status === 'PENDING' ? (
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => setBookingToCancel(selectedBooking)}
                >
                  Cancel Booking
                </Button>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CancelBookingDialog
        booking={bookingToCancel}
        isOpen={!!bookingToCancel}
        onClose={() => setBookingToCancel(null)}
        onSuccess={() => {
          setBookingToCancel(null);
          setSelectedBooking(null);
        }}
        venueMap={venueMap}
      />
    </AppLayout>
  );
}
