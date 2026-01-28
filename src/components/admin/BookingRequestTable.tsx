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
import { Check, X, Building, Calendar, Loader2, Clock, CheckCircle2, XCircle } from "lucide-react";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import type { Booking } from "@shared/types";
import { cn } from "@/lib/utils";
import { format } from 'date-fns';

interface BookingRequestTableProps {
  bookings: Booking[];
  isLoading: boolean;
  onActionSuccess: () => void;
  venueMap?: Record<string, string>;
}

export function BookingRequestTable({ bookings, isLoading, onActionSuccess, venueMap }: BookingRequestTableProps) {
  const [processingId, setProcessingId] = React.useState<string | null>(null);

  const handleStatusUpdate = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setProcessingId(id);
    try {
      await api(`/api/bookings/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status })
      });
      toast.success(`Booking ${status.toLowerCase()} successfully`, {
        description: status === 'APPROVED' ? 'The requester has been notified.' : 'The request has been declined.',
      });
      onActionSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return {
          icon: CheckCircle2,
          className: 'badge-success',
        };
      case 'PENDING':
        return {
          icon: Clock,
          className: 'badge-warning',
        };
      case 'REJECTED':
      case 'CANCELLED':
        return {
          icon: XCircle,
          className: 'badge-error',
        };
      default:
        return {
          icon: Clock,
          className: '',
        };
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
        <p className="text-sm font-medium">Loading bookings...</p>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-muted-foreground">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Calendar className="w-8 h-8 opacity-50" />
        </div>
        <p className="text-lg font-medium">No booking requests</p>
        <p className="text-sm">New requests will appear here</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="w-[220px] font-semibold">Requester</TableHead>
            <TableHead className="font-semibold">Venue & Schedule</TableHead>
            <TableHead className="font-semibold">Purpose</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="text-right font-semibold">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.map((booking, index) => {
            const statusConfig = getStatusConfig(booking.status);
            const StatusIcon = statusConfig.icon;

            return (
              <TableRow
                key={booking.id}
                className="table-row-hover animate-fade-in"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border-2 border-border">
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-bold">
                        {booking.userName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">{booking.userName}</span>
                      <span className="text-xs text-muted-foreground">ID: {booking.userId}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 font-medium">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span>{venueMap?.[booking.venueId] ?? booking.venueId}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{format(new Date(booking.date), 'MMM dd, yyyy')}</span>
                      <span className="text-muted-foreground/50">•</span>
                      <span>{booking.session.replace('_', ' ')}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="max-w-[250px]">
                  <p className="text-sm line-clamp-2">{booking.purpose}</p>
                </TableCell>
                <TableCell>
                  <Badge className={cn(
                    "text-xs font-bold uppercase px-3 py-1.5 flex items-center gap-1.5 w-fit",
                    statusConfig.className
                  )}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {booking.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {booking.status === 'PENDING' ? (
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm h-9 px-4"
                        disabled={!!processingId}
                        onClick={() => handleStatusUpdate(booking.id, 'APPROVED')}
                      >
                        {processingId === booking.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-1.5" />
                            Approve
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-950 h-9 px-4"
                        disabled={!!processingId}
                        onClick={() => handleStatusUpdate(booking.id, 'REJECTED')}
                      >
                        {processingId === booking.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <X className="h-4 w-4 mr-1.5" />
                            Reject
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">Processed</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}