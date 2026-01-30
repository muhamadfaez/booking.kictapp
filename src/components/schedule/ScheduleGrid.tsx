import React, { useMemo } from 'react';
import { format, addHours, startOfDay, isSameDay, parseISO, getHours, getMinutes } from 'date-fns';
import type { Venue, Booking, UserRole } from "@shared/types";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, User as UserIcon, Lock } from "lucide-react";

interface ScheduleGridProps {
    date: Date;
    venues: Venue[];
    bookings: Booking[];
    currentUserRole?: UserRole; // 'ADMIN' | 'USER'
    currentUserId?: string;
}

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8); // 8 AM to 10 PM (22:00)

export function ScheduleGrid({ date, venues, bookings, currentUserRole, currentUserId }: ScheduleGridProps) {

    // Helper to calculate position and height based on time
    const getPositionStyle = (startTime?: string, endTime?: string, session?: string) => {
        // Default to session-based if no precise time
        let startHour = 8;
        let durationHours = 1;

        if (startTime && endTime) {
            const [startH, startM] = startTime.split(':').map(Number);
            const [endH, endM] = endTime.split(':').map(Number);
            startHour = startH + (startM / 60);
            durationHours = (endH + (endM / 60)) - startHour;
        } else if (session) {
            // Fallback for legacy data
            switch (session) {
                case 'MORNING': startHour = 8; durationHours = 4; break;
                case 'AFTERNOON': startHour = 13; durationHours = 4; break;
                case 'EVENING': startHour = 18; durationHours = 4; break;
                case 'FULL_DAY': startHour = 8; durationHours = 14; break;
            }
        }

        // Grid starts at 8 AM. 1 hour = 60px (or whatever row height is)
        // We'll use CSS Grid rows. Let's say each row is 30 mins.
        // 8 AM is row 1. 24 hours * 2 = 48 rows.
        // Actually, let's just use absolute positioning percentage or pixels for simplicity in a relative container
        // OR: CSS Grid with 15 hours * 4 quarters = 60 rows? 
        // Let's stick to a simpler row-per-hour model for now to match the "Time" column.

        // Top offset relative to 8 AM
        const offsetHours = startHour - 8;
        const top = offsetHours * 60; // 60px per hour
        const height = durationHours * 60;

        return { top: `${top}px`, height: `${height}px` };
    };

    const getBookingColor = (index: number) => {
        const colors = [
            "border-l-blue-500 bg-blue-50/90 hover:bg-blue-100",
            "border-l-green-500 bg-green-50/90 hover:bg-green-100",
            "border-l-purple-500 bg-purple-50/90 hover:bg-purple-100",
            "border-l-amber-500 bg-amber-50/90 hover:bg-amber-100",
            "border-l-rose-500 bg-rose-50/90 hover:bg-rose-100",
        ];
        return colors[index % colors.length];
    };

    return (
        <div className="flex-1 overflow-auto bg-card rounded-lg shadow-sm border border-border/50">
            <div className="min-w-[800px]">
                {/* Header */}
                <div className="grid grid-cols-[80px_1fr] border-b sticky top-0 bg-card/95 backdrop-blur z-10">
                    <div className="p-4 border-r text-center font-bold text-muted-foreground">Time</div>
                    <div className="grid" style={{ gridTemplateColumns: `repeat(${venues.length}, 1fr)` }}>
                        {venues.map(venue => (
                            <div key={venue.id} className="p-4 text-center font-semibold border-r last:border-r-0 truncate px-2">
                                {venue.name}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Grid Body */}
                <div className="grid grid-cols-[80px_1fr] relative">

                    {/* Time Axis */}
                    <div className="border-r bg-muted/5">
                        {HOURS.map(hour => (
                            <div key={hour} className="h-[60px] border-b last:border-b-0 p-2 text-xs text-muted-foreground text-center relative group">
                                <span className="relative -top-3 bg-card px-1 rounded-full border shadow-sm">
                                    {format(new Date().setHours(hour, 0), 'hh a')}
                                </span>
                                {/* Horizontal guide line */}
                                <div className="absolute left-[80px] w-screen border-t border-dashed border-border/30 top-0 pointer-events-none" />
                            </div>
                        ))}
                    </div>

                    {/* Venue Columns Container */}
                    <div className="grid relative" style={{ gridTemplateColumns: `repeat(${venues.length}, 1fr)` }}>
                        {venues.map((venue, vIndex) => {
                            const venueBookings = bookings.filter(b => b.venueId === venue.id && isSameDay(parseISO(b.date), date));

                            return (
                                <div key={venue.id} className="border-r last:border-r-0 relative min-h-[900px]">
                                    {/* Hour grid lines (visual only) */}
                                    {HOURS.map(h => (
                                        <div key={h} className="h-[60px] border-b border-border/10" />
                                    ))}

                                    {/* Bookings */}
                                    {venueBookings.map((booking, bIndex) => {
                                        const style = getPositionStyle(booking.startTime, booking.endTime, booking.session);
                                        const isMyBooking = booking.userId === currentUserId;
                                        const canSeeDetails = currentUserRole === 'ADMIN' || isMyBooking;

                                        return (
                                            <TooltipProvider key={booking.id}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div
                                                            className={cn(
                                                                "absolute left-1 right-1 rounded border-l-4 p-2 text-xs transition-all cursor-pointer shadow-sm group overflow-hidden",
                                                                getBookingColor(vIndex + bIndex),
                                                                !canSeeDetails && "bg-slate-100 border-l-slate-400 opacity-80 grayscale"
                                                            )}
                                                            style={style}
                                                        >
                                                            <div className="font-semibold truncate">
                                                                {canSeeDetails ? booking.purpose : "Reserved"}
                                                            </div>
                                                            <div className="text-[10px] text-muted-foreground/80 truncate flex items-center gap-1 mt-0.5">
                                                                {canSeeDetails ? (
                                                                    <>
                                                                        <Clock className="w-3 h-3" />
                                                                        {booking.startTime && booking.endTime
                                                                            ? `${booking.startTime} - ${booking.endTime}`
                                                                            : booking.session}
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Lock className="w-3 h-3" />
                                                                        Occupied
                                                                    </>
                                                                )}
                                                            </div>

                                                            {canSeeDetails && (
                                                                <div className="mt-1 flex items-center gap-1 text-[10px] opacity-70">
                                                                    <UserIcon className="w-3 h-3" />
                                                                    {booking.userName}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="right" className="p-0 overflow-hidden border-none shadow-xl">
                                                        <div className="bg-popover p-3 text-popover-foreground rounded-lg border max-w-xs">
                                                            <h4 className="font-bold mb-1 text-sm">{booking.purpose}</h4>
                                                            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                                                                <Clock className="w-3 h-3" />
                                                                {booking.date} • {booking.startTime ? `${booking.startTime} - ${booking.endTime}` : booking.session}
                                                            </p>

                                                            <div className="space-y-1 text-xs pt-2 border-t">
                                                                <p><span className="font-semibold text-muted-foreground">Venue:</span> {venue.name}</p>
                                                                <p><span className="font-semibold text-muted-foreground">Booked by:</span> {canSeeDetails ? booking.userName : "Hidden"}</p>
                                                                <p><span className="font-semibold text-muted-foreground">Status:</span> <span className="capitalize">{booking.status.toLowerCase()}</span></p>
                                                            </div>
                                                        </div>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
