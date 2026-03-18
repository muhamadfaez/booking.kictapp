import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { BookingRequestTable } from '@/components/admin/BookingRequestTable';
import { AdminStats } from '@/components/admin/AdminStats';
import { api } from '@/lib/api-client';
import type { Booking, Venue, User, Notification } from '@shared/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { ShieldCheck, Clock, History, Bell } from 'lucide-react';
import { usePageTitle } from '@/hooks/use-page-title';
import { formatDistanceToNow } from 'date-fns';

export default function AdminPage() {
  usePageTitle('Admin');
  const { data: bookings, isLoading, refetch } = useQuery({
    queryKey: ['all-bookings'],
    queryFn: () => api<Booking[]>('/api/bookings')
  });

  const { data: venues = [] } = useQuery({
    queryKey: ['venues'],
    queryFn: () => api<Venue[]>('/api/venues')
  });
  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api<User[]>('/api/admin/users')
  });
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<Notification[]>('/api/notifications')
  });

  const venueMap = useMemo(() => Object.fromEntries(venues.map((v: Venue) => [v.id, v.name])), [venues]);
  const userMap = useMemo(
    () => Object.fromEntries(users.map((user) => [user.id, { name: user.name, email: user.email, avatar: user.avatar }])),
    [users]
  );
  const pendingBookings = useMemo(
    () => [...(bookings?.filter(b => b.status === 'PENDING') ?? [])].sort((a, b) => b.createdAt - a.createdAt),
    [bookings]
  );
  const historicalBookings = useMemo(
    () => [...(bookings?.filter(b => b.status !== 'PENDING') ?? [])].sort((a, b) => b.createdAt - a.createdAt),
    [bookings]
  );

  return (
    <AppLayout container>
      <div className="space-y-8">
        {/* Header */}
        <header className="relative overflow-hidden rounded-2xl bg-gradient-subtle p-8 border border-border/50">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-primary opacity-5 blur-3xl" />
          <div className="relative space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <ShieldCheck className="w-5 h-5" />
              <span className="text-sm font-medium uppercase tracking-wider">Admin Dashboard</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Admin Center
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Manage facility requests, monitor workspace usage, and maintain institutional control.
            </p>
          </div>
        </header>

        {/* Stats Grid */}
        <AdminStats bookings={bookings ?? []} venues={venues} />

        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="px-6 py-5 border-b border-border/50 bg-muted/30">
            <CardTitle className="flex items-center gap-2 text-lg font-bold">
              <Bell className="h-5 w-5 text-primary" />
              Admin Notifications
            </CardTitle>
            <CardDescription>
              Recent alerts tied to booking activity and admin actions.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {notifications.length === 0 ? (
              <div className="text-sm text-muted-foreground">No notifications yet.</div>
            ) : (
              <div className="space-y-3">
                {notifications.slice(0, 6).map((notification) => (
                  <div
                    key={notification.id}
                    className="rounded-xl border border-border/50 bg-card px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-medium">{notification.title}</div>
                        <div className="text-sm text-muted-foreground">{notification.message}</div>
                      </div>
                      <div className="shrink-0 text-xs text-muted-foreground">
                        {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Booking Management */}
        <div className="space-y-4">
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="bg-muted/50 p-1 rounded-xl h-auto mb-6">
              <TabsTrigger
                value="pending"
                className="rounded-lg px-6 py-3 data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all duration-200"
              >
                <Clock className="w-4 h-4 mr-2" />
                Pending Requests
                {pendingBookings.length > 0 && (
                  <span className="ml-2 rounded-full bg-primary text-primary-foreground px-2.5 py-0.5 text-xs font-bold">
                    {pendingBookings.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="rounded-lg px-6 py-3 data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all duration-200"
              >
                <History className="w-4 h-4 mr-2" />
                Resolution History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-0 animate-fade-in">
              <Card className="border-0 shadow-sm overflow-hidden">
                <CardHeader className="px-6 py-5 border-b border-border/50 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold">Awaiting Approval</CardTitle>
                      <CardDescription className="mt-1">
                        Review and process incoming booking requests
                      </CardDescription>
                    </div>
                    {pendingBookings.length > 0 && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        {pendingBookings.length} pending
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <BookingRequestTable
                    bookings={pendingBookings}
                    isLoading={isLoading}
                    onActionSuccess={refetch}
                    venueMap={venueMap}
                    userMap={userMap}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="mt-0 animate-fade-in">
              <Card className="border-0 shadow-sm overflow-hidden">
                <CardHeader className="px-6 py-5 border-b border-border/50 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold">Processed Requests</CardTitle>
                      <CardDescription className="mt-1">
                        History of approved and rejected bookings
                      </CardDescription>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {historicalBookings.length} records
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <BookingRequestTable
                    bookings={historicalBookings}
                    isLoading={isLoading}
                    onActionSuccess={refetch}
                    venueMap={venueMap}
                    userMap={userMap}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}
