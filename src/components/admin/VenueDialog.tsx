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
import { Building2, Loader2 } from "lucide-react";

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
        imageUrl: ''
    });

    const isEdit = !!venue;

    useEffect(() => {
        if (venue) {
            setFormData({
                name: venue.name,
                location: venue.location,
                capacity: String(venue.capacity),
                description: venue.description || '',
                imageUrl: venue.imageUrl || ''
            });
        } else {
            setFormData({
                name: '',
                location: '',
                capacity: '',
                description: '',
                imageUrl: ''
            });
        }
    }, [venue, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name || !formData.location || !formData.capacity) {
            toast.error("Please fill in all required fields");
            return;
        }

        setIsSubmitting(true);
        try {
            if (isEdit) {
                await api(`/api/venues/${venue.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(formData)
                });
                toast.success("Venue updated successfully");
            } else {
                await api('/api/venues', {
                    method: 'POST',
                    body: JSON.stringify(formData)
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
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
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

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
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
                            rows={3}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="imageUrl">Image URL</Label>
                        <Input
                            id="imageUrl"
                            type="url"
                            value={formData.imageUrl}
                            onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                            placeholder="https://example.com/image.jpg"
                        />
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting} className="btn-gradient">
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
                </form>
            </DialogContent>
        </Dialog>
    );
}
