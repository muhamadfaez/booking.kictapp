import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import type { Venue } from "@shared/types";
import { Building2, Loader2, UploadCloud } from "lucide-react";
import { compressImage } from '@/lib/image-compression';

interface VenueDialogProps {
    venue: Venue | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function VenueDialog({ venue, isOpen, onClose, onSuccess }: VenueDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        location: '',
        capacity: '',
        description: '',
        imageUrl: '',
        amenities: ''
    });

    const isEdit = !!venue;

    useEffect(() => {
        if (venue) {
            setFormData({
                name: venue.name,
                location: venue.location,
                capacity: String(venue.capacity),
                description: venue.description || '',
                imageUrl: venue.imageUrl || '',
                amenities: venue.amenities ? venue.amenities.join(', ') : ''
            });
        } else {
            setFormData({
                name: '',
                location: '',
                capacity: '',
                description: '',
                imageUrl: '',
                amenities: ''
            });
        }
    }, [venue, isOpen]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const toastId = toast.loading("Compressing and uploading image...");
        try {
            // Compress
            const compressedFile = await compressImage(file, 1); // Max 1MB

            // Upload
            const formData = new FormData();
            formData.append('file', compressedFile);
            formData.append('docType', 'VENUE_IMAGE'); // Special type for venue images
            formData.append('purpose', 'VenueImage');
            formData.append('date', new Date().toISOString().split('T')[0]);
            formData.append('userName', 'ADMIN');

            const token = localStorage.getItem('nexus_token');
            if (!token) {
                throw new Error("You are not logged in. Please refresh or login again.");
            }
            const headers: HeadersInit = {
                'Authorization': `Bearer ${token}`
            };

            const res = await fetch('/api/upload', {
                method: 'POST',
                headers,
                body: formData
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            setFormData(prev => ({ ...prev, imageUrl: data.data.url })); // Use webViewLink as image source
            toast.success("Image uploaded successfully", { id: toastId });
            console.log("Uploaded Image URL:", data.data.url); // Debug log
        } catch (err: any) {
            console.error(err);
            toast.error("Failed to upload image: " + err.message, { id: toastId });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name || !formData.location || !formData.capacity) {
            toast.error("Please fill in all required fields");
            return;
        }

        setIsSubmitting(true);
        try {
            // Convert comma-separated string back to array
            const amenitiesArray = formData.amenities
                .split(',')
                .map(s => s.trim())
                .filter(s => s.length > 0);

            const payload = {
                ...formData,
                amenities: amenitiesArray
            };

            if (isEdit) {
                await api(`/api/venues/${venue.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                toast.success("Venue updated successfully");
            } else {
                await api('/api/venues', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                toast.success("Venue created successfully");
            }
            onSuccess();
            onClose();
        } catch (err: any) {
            toast.error(err.message || "Failed to save venue");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] w-[95vw] max-h-[90vh] overflow-y-auto p-0 gap-0">
                <DialogHeader className="p-6 pb-2 sticky top-0 bg-background z-10 border-b">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <DialogTitle>{isEdit ? 'Edit Venue' : 'Add New Venue'}</DialogTitle>
                            <DialogDescription>
                                {isEdit ? 'Update venue information' : 'Create a new bookable venue'}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-6 py-4">
                    <form id="venue-form" onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Venue Name *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., Conference Room A"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="location">Location *</Label>
                            <Input
                                id="location"
                                value={formData.location}
                                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                placeholder="e.g., Building 1, Floor 2"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="capacity">Capacity *</Label>
                            <Input
                                id="capacity"
                                type="number"
                                min="1"
                                value={formData.capacity}
                                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                                placeholder="e.g., 50"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Brief description of the venue..."
                                rows={2}
                            />
                        </div>

                        {/* Facilities / Amenities */}
                        <div className="space-y-2">
                            <Label htmlFor="facilities">Facilities (comma separated)</Label>
                            <Textarea
                                id="facilities"
                                value={formData.amenities}
                                onChange={(e) => setFormData({ ...formData, amenities: e.target.value })}
                                placeholder="e.g., Projector, Whiteboard, AC, PA System"
                                rows={2}
                            />
                            <p className="text-xs text-muted-foreground">List available equipment and features.</p>
                        </div>

                        {/* Image Upload */}
                        <div className="space-y-2">
                            <Label>Venue Image</Label>
                            <div className="border-2 border-dashed rounded-xl p-4 transition-all border-muted-foreground/25 hover:border-primary/50 text-center">
                                {formData.imageUrl ? (
                                    <div className="space-y-3">
                                        <div className="relative aspect-video w-full max-w-[200px] mx-auto overflow-hidden rounded-lg border">
                                            <img src={formData.imageUrl} alt="Venue" className="object-cover w-full h-full" />
                                        </div>
                                        <div className="flex justify-center gap-2">
                                            <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('venue-image-upload')?.click()}>
                                                Change
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center gap-2 cursor-pointer py-2" onClick={() => document.getElementById('venue-image-upload')?.click()}>
                                        <UploadCloud className="w-8 h-8 text-muted-foreground" />
                                        <p className="text-sm font-medium">Click to upload image</p>
                                        <p className="text-xs text-muted-foreground">Max 1MB (Auto-compressed)</p>
                                    </div>
                                )}
                                <input
                                    id="venue-image-upload"
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                />
                            </div>
                        </div>
                    </form>
                </div>

                <DialogFooter className="p-6 pt-2 sticky bottom-0 bg-background z-10 border-t mt-auto gap-2 sm:gap-0">
                    <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button type="submit" form="venue-form" disabled={isSubmitting} className="btn-gradient">
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            isEdit ? 'Update Venue' : 'Create Venue'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
