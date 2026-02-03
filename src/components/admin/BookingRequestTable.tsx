import React, { useState } from 'react';
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
import { Check, X, Building, Calendar, Loader2, Clock, CheckCircle2, XCircle, FileText, Download, Eye } from "lucide-react";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import type { Booking } from "@shared/types";
import { cn } from "@/lib/utils";
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface BookingRequestTableProps {
  bookings: Booking[];
  isLoading: boolean;
  onActionSuccess: () => void;
  venueMap?: Record<string, string>;
}

export function BookingRequestTable({ bookings, isLoading, onActionSuccess, venueMap }: BookingRequestTableProps) {
  const [processingId, setProcessingId] = React.useState<string | null>(null);
  const [selectedBookingDocs, setSelectedBookingDocs] = useState<Booking | null>(null);

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
    <>
      <div className="w-full overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-[200px] font-semibold">Requester</TableHead>
              <TableHead className="font-semibold">Venue & Schedule</TableHead>
              <TableHead className="font-semibold">Purpose</TableHead>
              <TableHead className="font-semibold text-center">Docs</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="text-right font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((booking, index) => {
              const statusConfig = getStatusConfig(booking.status);
              const StatusIcon = statusConfig.icon;
              const hasDocs = booking.documents?.proposalUrl || booking.documents?.approvalLetterUrl;

              return (
                <TableRow
                  key={booking.id}
                  className="table-row-hover animate-fade-in"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border-2 border-border">
                        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-bold text-xs">
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
                        <Building className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{venueMap?.[booking.venueId] ?? booking.venueId}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{format(new Date(booking.date), 'MMM dd')}</span>
                        <span className="text-muted-foreground/50">•</span>
                        <span>{booking.startTime && booking.endTime ? `${booking.startTime}-${booking.endTime}` : (booking.session?.replace('_', ' ') || 'N/A')}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <p className="text-sm line-clamp-2" title={booking.purpose}>{booking.purpose}</p>
                  </TableCell>
                  <TableCell className="text-center">
                    {hasDocs ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-full hover:bg-primary/10 hover:text-primary"
                        onClick={() => setSelectedBookingDocs(booking)}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn(
                      "text-[10px] font-bold uppercase px-2 py-1 flex items-center gap-1 w-fit",
                      statusConfig.className
                    )}>
                      <StatusIcon className="w-3 h-3" />
                      {booking.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {booking.status === 'PENDING' ? (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm h-8 px-3 text-xs"
                          disabled={!!processingId}
                          onClick={() => handleStatusUpdate(booking.id, 'APPROVED')}
                        >
                          {processingId === booking.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <Check className="h-3.5 w-3.5 mr-1" />
                              Approve
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-950 h-8 px-3 text-xs"
                          disabled={!!processingId}
                          onClick={() => handleStatusUpdate(booking.id, 'REJECTED')}
                        >
                          {processingId === booking.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <X className="h-3.5 w-3.5 mr-1" />
                              Reject
                            </>
                          )}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Processed</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Documents Dialog */}
      <Dialog open={!!selectedBookingDocs} onOpenChange={(o) => !o && setSelectedBookingDocs(null)}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Attached Documents</DialogTitle>
            <DialogDescription>
              Review documents for {selectedBookingDocs?.purpose}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedBookingDocs?.documents?.proposalUrl && (
              <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Program Proposal</p>
                    <p className="text-xs text-muted-foreground">Main proposal document</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(selectedBookingDocs.documents!.proposalUrl, '_blank')}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  {selectedBookingDocs.documents.proposalDownloadUrl && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(selectedBookingDocs.documents!.proposalDownloadUrl, '_blank')}>
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {selectedBookingDocs?.documents?.approvalLetterUrl && (
              <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Approval Letter</p>
                    <p className="text-xs text-muted-foreground">SDCE Approval</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(selectedBookingDocs.documents!.approvalLetterUrl, '_blank')}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  {selectedBookingDocs.documents.approvalLetterDownloadUrl && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(selectedBookingDocs.documents!.approvalLetterDownloadUrl, '_blank')}>
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}