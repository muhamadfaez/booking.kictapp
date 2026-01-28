import React from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import type { Venue } from "@shared/types";
import { AlertTriangle } from "lucide-react";

interface DeleteVenueDialogProps {
    venue: Venue | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function DeleteVenueDialog({ venue, isOpen, onClose, onSuccess }: DeleteVenueDialogProps) {
    const [isDeleting, setIsDeleting] = React.useState(false);

    if (!venue) return null;

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await api(`/api/venues/${venue.id}`, {
                method: 'DELETE'
            });
            toast.success("Venue deleted successfully");
            onSuccess();
            onClose();
        } catch (err: any) {
            toast.error(err.message || "Failed to delete venue");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <AlertDialog open={isOpen} onOpenChange={onClose}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
                            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                            <AlertDialogTitle>Delete Venue?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone.
                            </AlertDialogDescription>
                        </div>
                    </div>
                </AlertDialogHeader>

                <div className="py-4 space-y-2">
                    <p className="text-sm">
                        Are you sure you want to delete <span className="font-semibold">{venue.name}</span>?
                    </p>
                    <p className="text-sm text-muted-foreground">
                        This venue will be permanently removed from the system.
                    </p>
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="bg-red-600 hover:bg-red-700 text-white"
                    >
                        {isDeleting ? 'Deleting...' : 'Delete Venue'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
