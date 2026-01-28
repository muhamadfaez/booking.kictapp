import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { VenueDialog } from '@/components/admin/VenueDialog';
import { DeleteVenueDialog } from '@/components/admin/DeleteVenueDialog';
import { api } from '@/lib/api-client';
import type { Venue } from '@shared/types';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, MapPin, Users, Plus, Edit, Trash2, Sparkles } from 'lucide-react';

export default function VenueManagementPage() {
    const { data: venues, isLoading, refetch } = useQuery({
        queryKey: ['venues'],
        queryFn: () => api<Venue[]>('/api/venues')
    });

    const [venueDialogOpen, setVenueDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);

    const handleAdd = () => {
        setSelectedVenue(null);
        setVenueDialogOpen(true);
    };

    const handleEdit = (venue: Venue) => {
        setSelectedVenue(venue);
        setVenueDialogOpen(true);
    };

    const handleDelete = (venue: Venue) => {
        setSelectedVenue(venue);
        setDeleteDialogOpen(true);
    };

    return (
        <AppLayout container>
            <div className="space-y-8">
                {/* Header */}
                <header className="relative overflow-hidden rounded-2xl bg-gradient-subtle p-8 border border-border/50">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-primary opacity-5 blur-3xl" />
                    <div className="relative flex items-center justify-between">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-primary">
                                <Building2 className="w-5 h-5" />
                                <span className="text-sm font-medium uppercase tracking-wider">Venue Management</span>
                            </div>
                            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                                Facility Control
                            </h1>
                            <p className="text-muted-foreground max-w-2xl">
                                Manage all bookable venues, update capacity, and control availability.
                            </p>
                        </div>
                        <Button className="btn-gradient h-12 px-6" onClick={handleAdd}>
                            <Plus className="w-5 h-5 mr-2" />
                            Add Venue
                        </Button>
                    </div>
                </header>

                {/* Venues Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {isLoading ? (
                        [1, 2, 3, 4, 5, 6].map(i => (
                            <Card key={i} className="overflow-hidden">
                                <Skeleton className="aspect-[4/3] w-full" />
                                <CardContent className="p-5 space-y-3">
                                    <Skeleton className="h-6 w-3/4" />
                                    <Skeleton className="h-4 w-1/2" />
                                    <Skeleton className="h-4 w-full" />
                                </CardContent>
                            </Card>
                        ))
                    ) : venues?.length === 0 ? (
                        <Card className="col-span-full py-16 border-dashed border-2 bg-muted/20">
                            <CardContent className="flex flex-col items-center justify-center text-muted-foreground">
                                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                    <Building2 className="w-8 h-8 opacity-50" />
                                </div>
                                <p className="text-lg font-medium">No venues yet</p>
                                <p className="text-sm">Add your first venue to get started</p>
                            </CardContent>
                        </Card>
                    ) : (
                        venues?.map((venue, index) => (
                            <Card
                                key={venue.id}
                                className="group overflow-hidden border hover:shadow-lg transition-all duration-300 hover:border-border animate-fade-in"
                                style={{ animationDelay: `${index * 0.1}s` }}
                            >
                                {/* Venue Image */}
                                <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5">
                                    {venue.imageUrl ? (
                                        <img
                                            src={venue.imageUrl}
                                            alt={venue.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Building2 className="w-16 h-16 text-muted-foreground/30" />
                                        </div>
                                    )}
                                    <div className="absolute top-3 right-3">
                                        <Badge className="bg-card/90 backdrop-blur-sm text-foreground border-border">
                                            ID: {venue.id}
                                        </Badge>
                                    </div>
                                </div>

                                <CardContent className="p-5 space-y-4">
                                    {/* Venue Info */}
                                    <div className="space-y-2">
                                        <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors">
                                            {venue.name}
                                        </CardTitle>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <MapPin className="w-4 h-4" />
                                            <span>{venue.location}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Users className="w-4 h-4" />
                                            <span>Capacity: {venue.capacity} people</span>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    {venue.description && (
                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                            {venue.description}
                                        </p>
                                    )}

                                    {/* Actions */}
                                    <div className="flex gap-2 pt-2 border-t border-border/50">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => handleEdit(venue)}
                                        >
                                            <Edit className="w-4 h-4 mr-1.5" />
                                            Edit
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-950"
                                            onClick={() => handleDelete(venue)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>

                {/* Stats Summary */}
                {venues && venues.length > 0 && (
                    <Card className="bg-gradient-subtle border-border/50">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Sparkles className="w-6 h-6 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{venues.length}</p>
                                        <p className="text-sm text-muted-foreground">Total Venues</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-bold">
                                        {venues.reduce((sum, v) => sum + v.capacity, 0)}
                                    </p>
                                    <p className="text-sm text-muted-foreground">Total Capacity</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            <VenueDialog
                venue={selectedVenue}
                isOpen={venueDialogOpen}
                onClose={() => setVenueDialogOpen(false)}
                onSuccess={refetch}
            />

            <DeleteVenueDialog
                venue={selectedVenue}
                isOpen={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                onSuccess={refetch}
            />
        </AppLayout>
    );
}
