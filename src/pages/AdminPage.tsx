import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { BookingRequestTable } from '@/components/admin/BookingRequestTable';
import { AdminStats } from '@/components/admin/AdminStats';
import { api } from '@/lib/api-client';
import type { Booking } from '@shared/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
export default function AdminPage() {
  const { data: bookings, isLoading, refetch } = useQuery({
    queryKey: ['all-bookings'],
    queryFn: () => api<Booking[]>('/api/bookings')
  });
  const pendingBookings = bookings?.filter(b => b.status === 'PENDING') ?? [];
  const historicalBookings = bookings?.filter(b => b.status !== 'PENDING') ?? [];
  return (
    <AppLayout container>
      <div className="space-y-10">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Command Center</h1>
          <p className="text-muted-foreground">Manage facility requests and monitor institutional workspace usage.</p>
        </header>
        <AdminStats bookings={bookings ?? []} />
        <div className="space-y-4">
          <Tabs defaultValue="pending" className="w-full">
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="pending">
                  Pending Requests
                  {pendingBookings.length > 0 && (
                    <span className="ml-2 rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-xs font-bold">
                      {pendingBookings.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="history">Resolution History</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="pending" className="mt-0">
              <Card>
                <CardHeader className="px-6 py-4">
                  <CardTitle className="text-lg">Waiting for Approval</CardTitle>
                  <CardDescription>Review and manage incoming booking requests.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <BookingRequestTable 
                    bookings={pendingBookings} 
                    isLoading={isLoading} 
                    onActionSuccess={refetch} 
                  />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="history" className="mt-0">
              <Card>
                <CardHeader className="px-6 py-4">
                  <CardTitle className="text-lg">Recent Actions</CardTitle>
                  <CardDescription>Overview of processed requests.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <BookingRequestTable 
                    bookings={historicalBookings} 
                    isLoading={isLoading} 
                    onActionSuccess={refetch} 
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