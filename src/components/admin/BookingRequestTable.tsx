import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Check, X, Building, Calendar, User as UserIcon, Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import type { Booking } from "@shared/types";
import { cn } from "@/lib/utils";
interface BookingRequestTableProps {
  bookings: Booking[];
  isLoading: boolean;
  onActionSuccess: () => void;
}
export function BookingRequestTable({ bookings, isLoading, onActionSuccess }: BookingRequestTableProps) {
  const [processingId, setProcessingId] = React.useState<string | null>(null);
  const handleStatusUpdate = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setProcessingId(id);
    try {
      await api(`/api/bookings/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status })
      });
      toast.success(`Booking ${status.toLowerCase()} successfully`);
      onActionSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setProcessingId(null);
    }
  };
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p>Loading bookings...</p>
      </div>
    );
  }
  if (bookings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
        <p>No booking requests found.</p>
      </div>
    );
  }
  return (
    <div className="w-full">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[200px]">Requester</TableHead>
            <TableHead>Venue & Slot</TableHead>
            <TableHead>Purpose</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.map((booking) => (
            <TableRow key={booking.id} className="hover:bg-muted/30 transition-colors">
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {booking.userName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{booking.userName}</span>
                    <span className="text-[10px] text-muted-foreground">{booking.userId}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-sm">
                    <Building className="h-3 w-3 text-muted-foreground" />
                    <span>{booking.venueId}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{booking.date} • {booking.session}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell className="max-w-[200px]">
                <p className="text-sm truncate">{booking.purpose}</p>
              </TableCell>
              <TableCell>
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "text-[10px] font-bold uppercase",
                    booking.status === 'APPROVED' && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                    booking.status === 'PENDING' && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                    booking.status === 'REJECTED' && "bg-destructive/10 text-destructive"
                  )}
                >
                  {booking.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {booking.status === 'PENDING' ? (
                  <div className="flex items-center justify-end gap-2">
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                      disabled={!!processingId}
                      onClick={() => handleStatusUpdate(booking.id, 'APPROVED')}
                    >
                      {processingId === booking.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      disabled={!!processingId}
                      onClick={() => handleStatusUpdate(booking.id, 'REJECTED')}
                    >
                      {processingId === booking.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground italic">Processed</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}