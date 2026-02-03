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
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import type { Booking } from "@shared/types";
import { Calendar, Clock, Building, AlertTriangle } from "lucide-react";
import { format } from 'date-fns';

interface CancelBookingDialogProps {
    booking: Booking | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    venueMap?: Record<string, string>;
}

export function CancelBookingDialog({ booking, isOpen, onClose, onSuccess, venueMap }: CancelBookingDialogProps) {
    const [isCancelling, setIsCancelling] = React.useState(false);

    if (!booking) return null;

    const handleCancel = async () => {
        setIsCancelling(true);
        try {
            await api(`/api/bookings/${booking.id}?userId=${booking.userId}`, {
                method: 'DELETE'
            });
            toast.success("Booking cancelled successfully", {
                description: "Your booking request has been cancelled."
            });
            onSuccess();
            onClose();
        } catch (err: any) {
            toast.error(err.message || "Failed to cancel booking");
        } finally {
            setIsCancelling(false);
        }
    };

    return (
        <AlertDialog open={isOpen} onOpenChange={onClose}>
            <AlertDialogContent className="w-[95vw] sm:max-w-[500px]">
                <AlertDialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
                            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                            <AlertDialogTitle className="text-xl">Cancel Booking?</AlertDialogTitle>
                            <AlertDialogDescription className="mt-1">
                                This action cannot be undone.
                            </AlertDialogDescription>
                        </div>
                    </div>
                </AlertDialogHeader>

                {/* Booking Details */}
                <div className="space-y-3 py-4 border-y border-border">
                    <div className="flex items-center gap-3">
                        <Building className="w-4 h-4 text-muted-foreground" />
                        <div>
                            <p className="text-sm text-muted-foreground">Venue</p>
                            <p className="font-semibold">{venueMap?.[booking.venueId] ?? booking.venueId}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <div>
                            <p className="text-sm text-muted-foreground">Date</p>
                            <p className="font-semibold">{format(new Date(booking.date), 'MMMM dd, yyyy')}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <div>
                            <p className="text-sm text-muted-foreground">Session</p>
                            <p className="font-semibold">{booking.session.replace('_', ' ')}</p>
                        </div>
                    </div>

                    <div>
                        <p className="text-sm text-muted-foreground mb-1">Purpose</p>
                        <p className="text-sm">{booking.purpose}</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground">Status:</p>
                        <Badge className="badge-warning text-xs">
                            {booking.status}
                        </Badge>
                    </div>
                </div>

                <AlertDialogFooter className="gap-2 sm:gap-0">
                    <AlertDialogCancel disabled={isCancelling}>
                        Keep Booking
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleCancel}
                        disabled={isCancelling}
                        className="bg-red-600 hover:bg-red-700 text-white"
                    >
                        {isCancelling ? 'Cancelling...' : 'Yes, Cancel Booking'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
