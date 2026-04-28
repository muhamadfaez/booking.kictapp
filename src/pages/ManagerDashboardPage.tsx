import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { BriefcaseBusiness, Building2, CalendarDays, Check, Clock, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api-client';
import { usePageTitle } from '@/hooks/use-page-title';
import type { Booking, ManagerAssignment, Venue } from '@shared/types';

type ManagerProfile = {
  isManager: boolean;
  assignments: ManagerAssignment[];
  venues: Venue[];
  venueIds: string[];
};

const parseLocalDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const bookingTime = (booking: Booking) =>
  booking.startTime && booking.endTime
    ? `${booking.startTime} - ${booking.endTime}`
    : booking.session?.replace('_', ' ') || 'N/A';

function statusBadge(status: Booking['status']) {
  if (status === 'APPROVED') return 'badge-success';
  if (status === 'PENDING') return 'badge-warning';
  return 'badge-error';
}

export default function ManagerDashboardPage() {
  usePageTitle('Venue Manager');
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingBooking, setRejectingBooking] = useState<Booking | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['manager-profile'],
    queryFn: () => api<ManagerProfile>('/api/manager/profile')
  });

  const { data: bookings = [], isLoading: bookingsLoading, refetch } = useQuery({
    queryKey: ['manager-bookings'],
    queryFn: () => api<Booking[]>('/api/manager/bookings'),
    enabled: !!profile?.isManager
  });

  const venueMap = useMemo(
    () => Object.fromEntries((profile?.venues || []).map((venue) => [venue.id, venue.name])),
    [profile?.venues]
  );

  const sortedBookings = useMemo(
    () => [...bookings].sort((a, b) => b.createdAt - a.createdAt),
    [bookings]
  );

  const grouped = useMemo(() => ({
    PENDING: sortedBookings.filter((booking) => booking.status === 'PENDING'),
    APPROVED: sortedBookings.filter((booking) => booking.status === 'APPROVED'),
    REJECTED: sortedBookings.filter((booking) => booking.status === 'REJECTED')
  }), [sortedBookings]);

  const handleStatusUpdate = async (booking: Booking, status: 'APPROVED' | 'REJECTED', note = '') => {
    setProcessingId(booking.id);
    try {
      await api<Booking>(`/api/manager/bookings/${booking.id}/status`, {
        method: 'POST',
        body: JSON.stringify({
          status,
          rejectionReason: note
        })
      });
      toast.success(status === 'APPROVED' ? 'Booking approved' : 'Booking rejected', {
        description: 'The requester has been notified and admin was copied by email.'
      });
      setRejectingBooking(null);
      setRejectionReason('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['manager-bookings'] }),
        queryClient.invalidateQueries({ queryKey: ['bookings-schedule'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
      ]);
      await refetch();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update booking');
    } finally {
      setProcessingId(null);
    }
  };

  const renderBookings = (items: Booking[]) => {
    if (bookingsLoading || profileLoading) {
      return (
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
          Loading bookings...
        </div>
      );
    }

    if (items.length === 0) {
      return <div className="p-8 text-sm text-muted-foreground">No bookings in this status.</div>;
    }

    return (
      <div className="divide-y divide-border">
        {items.map((booking) => (
          <div key={booking.id} className="grid gap-4 p-4 lg:grid-cols-[1.2fr_1.2fr_1fr_auto] lg:items-center">
            <div className="min-w-0">
              <div className="font-semibold">{booking.userName}</div>
              <div className="truncate text-sm text-muted-foreground">{booking.userEmail || booking.userId}</div>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {venueMap[booking.venueId] || booking.venueId}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                <span>{format(parseLocalDate(booking.date), 'MMM d, yyyy')}</span>
                <span>{bookingTime(booking)}</span>
              </div>
            </div>
            <div className="min-w-0 space-y-2">
              <Badge className={statusBadge(booking.status)}>{booking.status}</Badge>
              <p className="line-clamp-2 text-sm text-muted-foreground" title={booking.purpose}>{booking.purpose}</p>
              {booking.rejectionReason ? (
                <p className="line-clamp-2 text-xs text-red-600" title={booking.rejectionReason}>{booking.rejectionReason}</p>
              ) : null}
            </div>
            <div className="flex justify-end gap-2">
              {booking.status === 'PENDING' ? (
                <>
                  <Button
                    size="sm"
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                    disabled={!!processingId}
                    onClick={() => handleStatusUpdate(booking, 'APPROVED')}
                  >
                    {processingId === booking.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    disabled={!!processingId}
                    onClick={() => {
                      setRejectingBooking(booking);
                      setRejectionReason('');
                    }}
                  >
                    <X className="mr-1 h-4 w-4" />
                    Reject
                  </Button>
                </>
              ) : (
                <span className="text-xs italic text-muted-foreground">Processed</span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (!profileLoading && profile && !profile.isManager) {
    return (
      <AppLayout container>
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Venue Manager Access</CardTitle>
            <CardDescription>Your account is not assigned to any venue manager role.</CardDescription>
          </CardHeader>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout container>
      <div className="space-y-8">
        <header className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-subtle p-8">
          <div className="relative space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <BriefcaseBusiness className="h-5 w-5" />
              <span className="text-sm font-medium uppercase tracking-wider">Venue Manager</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Manager Dashboard</h1>
            <p className="max-w-2xl text-muted-foreground">
              Review and process booking requests for your assigned venues only.
            </p>
          </div>
        </header>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Assigned Scope</CardTitle>
            <CardDescription>
              {(profile?.venues.length || 0)} venue{profile?.venues.length === 1 ? '' : 's'} assigned across {(profile?.assignments.length || 0)} manager role{profile?.assignments.length === 1 ? '' : 's'}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {profile?.venues.map((venue) => (
                <Badge key={venue.id} variant="secondary">{venue.name}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="PENDING">
          <TabsList className="h-auto rounded-xl bg-muted/50 p-1">
            <TabsTrigger value="PENDING" className="rounded-lg px-5 py-2.5">
              <Clock className="mr-2 h-4 w-4" />
              Pending
              {grouped.PENDING.length > 0 ? <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{grouped.PENDING.length}</span> : null}
            </TabsTrigger>
            <TabsTrigger value="APPROVED" className="rounded-lg px-5 py-2.5">Approved</TabsTrigger>
            <TabsTrigger value="REJECTED" className="rounded-lg px-5 py-2.5">Rejected</TabsTrigger>
          </TabsList>

          <TabsContent value="PENDING" className="mt-5">
            <Card className="overflow-hidden border-0 shadow-sm">{renderBookings(grouped.PENDING)}</Card>
          </TabsContent>
          <TabsContent value="APPROVED" className="mt-5">
            <Card className="overflow-hidden border-0 shadow-sm">{renderBookings(grouped.APPROVED)}</Card>
          </TabsContent>
          <TabsContent value="REJECTED" className="mt-5">
            <Card className="overflow-hidden border-0 shadow-sm">{renderBookings(grouped.REJECTED)}</Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!rejectingBooking} onOpenChange={(open) => !open && setRejectingBooking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Booking</DialogTitle>
            <DialogDescription>
              Add an optional note for the requester. Admin will be copied on the notification email.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            placeholder="Reason or note"
            className="min-h-28"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingBooking(null)} disabled={!!processingId}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!rejectingBooking || !!processingId}
              onClick={() => rejectingBooking && handleStatusUpdate(rejectingBooking, 'REJECTED', rejectionReason)}
            >
              {processingId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Reject Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
