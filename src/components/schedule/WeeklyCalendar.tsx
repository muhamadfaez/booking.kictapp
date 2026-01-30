import React, { useMemo, useRef, useEffect } from 'react';
import { format, addDays, startOfWeek, isSameDay, isToday, setHours, setMinutes, differenceInMinutes, startOfDay, getHours, getMinutes } from 'date-fns';
import type { Venue, Booking, UserRole } from "@shared/types";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, User as UserIcon, Lock, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WeeklyCalendarProps {
    date: Date;
    setDate: (date: Date) => void;
    venues: Venue[];
    bookings: Booking[];
    currentUserRole?: UserRole;
    currentUserId?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0 to 23

export function WeeklyCalendar({ date, setDate, venues, bookings, currentUserRole, currentUserId }: WeeklyCalendarProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    // Calculate the start of the current week view
    const weekStart = useMemo(() => startOfWeek(date, { weekStartsOn: 0 }), [date]); // Sunday start

    // Generate the 7 days of the week
    const weekDays = useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    }, [weekStart]);

    // Scroll to 8 AM on initial load
    useEffect(() => {
        if (containerRef.current) {
            const eightAM = 8 * 60; // 60px per hour
            containerRef.current.scrollTop = eightAM;
        }
    }, []);

    const navigateWeek = (direction: 'prev' | 'next') => {
        const newDate = addDays(date, direction === 'prev' ? -7 : 7);
        setDate(newDate);
    };

    const goToToday = () => {
        setDate(new Date());
    };

    // Helper to calculate position and height based on time
    const getPositionStyle = (startTime?: string, endTime?: string, session?: string) => {
        let startHour = 8;
        let durationMinutes = 60;

        if (startTime && endTime) {
            const [startH, startM] = startTime.split(':').map(Number);
            const [endH, endM] = endTime.split(':').map(Number);
            startHour = startH + (startM / 60);

            const startTotalMinutes = startH * 60 + startM;
            const endTotalMinutes = endH * 60 + endM;
            durationMinutes = endTotalMinutes - startTotalMinutes;
        } else if (session) {
            // Fallback for legacy data/sessions
            switch (session) {
                case 'MORNING': startHour = 8; durationMinutes = 4 * 60; break;
                case 'AFTERNOON': startHour = 13; durationMinutes = 4 * 60; break;
                case 'EVENING': startHour = 18; durationMinutes = 4 * 60; break;
                case 'FULL_DAY': startHour = 8; durationMinutes = 14 * 60; break;
            }
        }

        const top = startHour * 60; // 60px per hour
        const height = (durationMinutes / 60) * 60;

        return { top: `${top}px`, height: `${height}px` };
    };

    // Color generation based on venue ID (consistent colors for same venue)
    const getVenueColor = (venueId: string) => {
        // Simple hash to pick a color index
        const hash = venueId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const colors = [
            "bg-blue-100 border-blue-500 text-blue-700 hover:bg-blue-200",
            "bg-green-100 border-green-500 text-green-700 hover:bg-green-200",
            "bg-purple-100 border-purple-500 text-purple-700 hover:bg-purple-200",
            "bg-amber-100 border-amber-500 text-amber-700 hover:bg-amber-200",
            "bg-rose-100 border-rose-500 text-rose-700 hover:bg-rose-200",
            "bg-indigo-100 border-indigo-500 text-indigo-700 hover:bg-indigo-200",
            "bg-orange-100 border-orange-500 text-orange-700 hover:bg-orange-200",
            "bg-teal-100 border-teal-500 text-teal-700 hover:bg-teal-200",
        ];
        return colors[hash % colors.length];
    };

    return (
        <div className="flex flex-col h-full bg-background rounded-lg border shadow-sm overflow-hidden">
            {/* Calendar Header Controls */}
            <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="sm" onClick={goToToday}>Today</Button>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => navigateWeek('prev')}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => navigateWeek('next')}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                    <h2 className="text-xl font-semibold">
                        {format(weekStart, 'MMMM yyyy')}
                    </h2>
                </div>
                {/* Legend could go here if needed */}
                <div className="flex gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-blue-100 border border-blue-500"></div>
                        <span>Events are color-coded by venue</span>
                    </div>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Time Axis Sidebar */}
                <div className="w-16 flex-shrink-0 border-r bg-muted/5 overflow-hidden flex flex-col pt-[50px]">
                    {HOURS.map(hour => (
                        <div key={hour} className="h-[60px] text-xs text-muted-foreground text-center -mt-2.5 relative">
                            {hour === 0 ? '' : format(setHours(new Date(), hour), 'h a')}
                        </div>
                    ))}
                </div>

                {/* Main Grid Area */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Days Header */}
                    <div className="h-[50px] border-b flex bg-card z-10 pr-4"> {/* pr-4 for scrollbar compensation */}
                        {weekDays.map((day, i) => (
                            <div key={i} className={cn(
                                "flex-1 flex flex-col items-center justify-center border-r last:border-r-0",
                                isToday(day) && "bg-primary/5"
                            )}>
                                <span className={cn(
                                    "text-xs font-medium uppercase text-muted-foreground mb-1",
                                    isToday(day) && "text-primary"
                                )}>
                                    {format(day, 'EEE')}
                                </span>
                                <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold",
                                    isToday(day) ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                                )}>
                                    {format(day, 'd')}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Scrollable Grid Body */}
                    <div ref={containerRef} className="flex-1 overflow-y-auto relative">
                        <div className="flex min-h-[1440px] relative"> {/* 24 hours * 60px */}

                            {/* Horizontal Hour Lines */}
                            <div className="absolute inset-0 flex flex-col pointer-events-none">
                                {HOURS.map(hour => (
                                    <div key={hour} className="h-[60px] border-b border-border/40 w-full" />
                                ))}
                            </div>

                            {/* Day Columns */}
                            {weekDays.map((day, dayIndex) => {
                                const dayBookings = bookings.filter(b => isSameDay(new Date(b.date), day));

                                return (
                                    <div key={dayIndex} className="flex-1 border-r last:border-r-0 relative">
                                        {/* Current Time Indicator Line (if today) */}
                                        {isToday(day) && (
                                            <div
                                                className="absolute w-full border-t-2 border-red-500 z-50 pointer-events-none flex items-center"
                                                style={{ top: `${(getHours(new Date()) * 60) + getMinutes(new Date())}px` }}
                                            >
                                                <div className="w-2 h-2 rounded-full bg-red-500 -ml-1"></div>
                                            </div>
                                        )}

                                        {dayBookings.map((booking) => {
                                            const venue = venues.find(v => v.id === booking.venueId);
                                            const style = getPositionStyle(booking.startTime, booking.endTime, booking.session);
                                            const isMyBooking = booking.userId === currentUserId;
                                            const canSeeDetails = currentUserRole === 'ADMIN' || isMyBooking;

                                            return (
                                                <TooltipProvider key={booking.id}>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div
                                                                className={cn(
                                                                    "absolute left-0.5 right-1 rounded border-l-4 p-1.5 text-xs transition-all cursor-pointer shadow-sm group overflow-hidden hover:z-20 hover:shadow-md",
                                                                    getVenueColor(booking.venueId),
                                                                    !canSeeDetails && "opacity-80 grayscale"
                                                                )}
                                                                style={style}
                                                            >
                                                                <div className="font-semibold truncate leading-tight">
                                                                    {canSeeDetails ? booking.purpose : "Reserved"}
                                                                </div>
                                                                <div className="text-[10px] opacity-80 truncate flex items-center gap-1 mt-0.5">
                                                                    <Clock className="w-3 h-3" />
                                                                    {booking.startTime && booking.endTime
                                                                        ? `${booking.startTime} - ${booking.endTime}`
                                                                        : booking.session}
                                                                </div>
                                                                <div className="text-[10px] font-medium opacity-90 truncate mt-0.5 flex items-center gap-1">
                                                                    <MapPin className="w-3 h-3" />
                                                                    {venue?.name || "Unknown Venue"}
                                                                </div>
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="p-0 border-none shadow-xl bg-background text-foreground z-50">
                                                            <div className="p-3 w-64 border rounded-md bg-popover">
                                                                <h4 className="font-bold mb-1">{booking.purpose}</h4>
                                                                <div className="space-y-1 text-sm text-muted-foreground">
                                                                    <div className="flex items-center gap-2">
                                                                        <Clock className="w-4 h-4" />
                                                                        <span>{format(new Date(booking.date), 'MMM d, yyyy')}</span>
                                                                    </div>
                                                                    <div className="ml-6 text-xs">
                                                                        {booking.startTime && booking.endTime
                                                                            ? `${booking.startTime} - ${booking.endTime}`
                                                                            : booking.session}
                                                                    </div>
                                                                    <div className="flex items-center gap-2 pt-2 border-t mt-2">
                                                                        <MapPin className="w-4 h-4" />
                                                                        <span className="font-semibold text-foreground">{venue?.name}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <UserIcon className="w-4 h-4" />
                                                                        <span>{canSeeDetails ? booking.userName : "Hidden User"}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            )
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
