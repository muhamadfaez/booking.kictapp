import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { BookingRequestTable } from '@/components/admin/BookingRequestTable';
import { api } from '@/lib/api-client';
import type { Booking, Venue } from '@shared/types';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { History, Search, Filter, Download, RefreshCw } from 'lucide-react';

export default function BookingHistoryPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');

    const { data: bookings, isLoading, refetch } = useQuery({
        queryKey: ['all-bookings'],
        queryFn: () => api<Booking[]>('/api/bookings')
    });

    const { data: venues = [] } = useQuery({
        queryKey: ['venues'],
        queryFn: () => api<Venue[]>('/api/venues')
    });

    const venueMap = useMemo(() => Object.fromEntries(venues.map((v: Venue) => [v.id, v.name])), [venues]);

    // Filter bookings based on search and status
    const filteredBookings = useMemo(() => {
        if (!bookings) return [];

        let filtered = bookings;

        // Status filter
        if (statusFilter !== 'ALL') {
            filtered = filtered.filter(b => b.status === statusFilter);
        }

        // Search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(b =>
                b.userName.toLowerCase().includes(query) ||
                b.purpose.toLowerCase().includes(query) ||
                venueMap[b.venueId]?.toLowerCase().includes(query) ||
                b.userId.toLowerCase().includes(query)
            );
        }

        // Sort by createdAt (desc) or date (desc)
        return filtered.sort((a, b) => {
            const timeA = a.createdAt || new Date(a.date).getTime();
            const timeB = b.createdAt || new Date(b.date).getTime();
            return timeB - timeA;
        });
    }, [bookings, statusFilter, searchQuery, venueMap]);

    const stats = useMemo(() => {
        if (!bookings) return { total: 0, approved: 0, rejected: 0, pending: 0, cancelled: 0 };
        return {
            total: bookings.length,
            approved: bookings.filter(b => b.status === 'APPROVED').length,
            rejected: bookings.filter(b => b.status === 'REJECTED').length,
            pending: bookings.filter(b => b.status === 'PENDING').length,
            cancelled: bookings.filter(b => b.status === 'CANCELLED').length,
        };
    }, [bookings]);

    return (
        <AppLayout container>
            <div className="space-y-8">
                {/* Header */}
                <header className="relative overflow-hidden rounded-2xl bg-gradient-subtle p-8 border border-border/50">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-primary opacity-5 blur-3xl" />
                    <div className="relative space-y-3">
                        <div className="flex items-center gap-2 text-primary">
                            <History className="w-5 h-5" />
                            <span className="text-sm font-medium uppercase tracking-wider">Booking History</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                            Complete Records
                        </h1>
                        <p className="text-muted-foreground max-w-2xl">
                            View and search through all booking requests across all venues and time periods.
                        </p>
                    </div>
                </header>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <Card className="bg-gradient-subtle border-border/50">
                        <CardContent className="p-4 text-center">
                            <p className="text-2xl font-bold">{stats.total}</p>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-subtle border-border/50">
                        <CardContent className="p-4 text-center">
                            <p className="text-2xl font-bold text-emerald-600">{stats.approved}</p>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Approved</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-subtle border-border/50">
                        <CardContent className="p-4 text-center">
                            <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Pending</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-subtle border-border/50">
                        <CardContent className="p-4 text-center">
                            <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Rejected</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-subtle border-border/50">
                        <CardContent className="p-4 text-center">
                            <p className="text-2xl font-bold text-gray-600">{stats.cancelled}</p>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Cancelled</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <Card className="border-border/50">
                    <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row gap-4">
                            {/* Search */}
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by user, venue, or purpose..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 h-11 rounded-xl"
                                />
                            </div>

                            {/* Status Filter */}
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-full md:w-[200px] h-11 rounded-xl">
                                    <Filter className="w-4 h-4 mr-2" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Status</SelectItem>
                                    <SelectItem value="PENDING">Pending</SelectItem>
                                    <SelectItem value="APPROVED">Approved</SelectItem>
                                    <SelectItem value="REJECTED">Rejected</SelectItem>
                                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Refresh Button */}
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-11 w-11 rounded-xl"
                                onClick={() => refetch()}
                            >
                                <RefreshCw className="w-4 h-4" />
                            </Button>

                            {/* Export Button */}
                            <Button
                                variant="outline"
                                className="h-11 rounded-xl px-6"
                                onClick={() => {
                                    // Simple CSV export
                                    const csv = [
                                        ['Date', 'User', 'Venue', 'Session', 'Purpose', 'Status'].join(','),
                                        ...filteredBookings.map(b => [
                                            b.date,
                                            b.userName,
                                            venueMap[b.venueId] || b.venueId,
                                            b.startTime && b.endTime ? `${b.startTime}-${b.endTime}` : (b.session || 'N/A'),
                                            `"${b.purpose.replace(/"/g, '""')}"`,
                                            b.status
                                        ].join(','))
                                    ].join('\n');

                                    const blob = new Blob([csv], { type: 'text/csv' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `bookings-${new Date().toISOString().split('T')[0]}.csv`;
                                    a.click();
                                }}
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Export CSV
                            </Button>
                        </div>

                        {/* Results count */}
                        <div className="mt-4 text-sm text-muted-foreground">
                            Showing {filteredBookings.length} of {bookings?.length || 0} bookings
                        </div>
                    </CardContent>
                </Card>

                {/* Bookings Table */}
                <Card className="border-0 shadow-sm overflow-hidden">
                    <CardHeader className="px-6 py-5 border-b border-border/50 bg-muted/30">
                        <CardTitle className="text-lg font-bold">All Booking Records</CardTitle>
                        <CardDescription className="mt-1">
                            Complete history of all booking requests and their current status
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <BookingRequestTable
                            bookings={filteredBookings}
                            isLoading={isLoading}
                            onActionSuccess={refetch}
                            venueMap={venueMap}
                        />
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
