import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
    format, addDays, startOfWeek, isSameDay, isToday, setHours, setMinutes,
    differenceInMinutes, startOfDay, getHours, getMinutes, addMonths, startOfMonth,
    endOfMonth, endOfWeek, eachDayOfInterval, isSameMonth, addYears, startOfYear,
    endOfYear, eachMonthOfInterval
} from 'date-fns';
import type { Venue, Booking, UserRole } from "@shared/types";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, User as UserIcon, Lock, ChevronLeft, ChevronRight, MapPin, Calendar as CalendarIcon, Filter, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"

type CalendarViewMode = 'day' | 'week' | 'month' | 'year';

interface CalendarViewProps {
    date: Date;
    setDate: (date: Date) => void;
    venues: Venue[];
    bookings: Booking[];
    currentUserRole?: UserRole;
    currentUserId?: string;
    onVenueFilterChange?: (venueIds: string[]) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function CalendarView({
    date,
    setDate,
    venues,
    bookings,
    currentUserRole,
    currentUserId,
    onVenueFilterChange
}: CalendarViewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [view, setView] = useState<CalendarViewMode>('week');
    const [selectedVenues, setSelectedVenues] = useState<string[]>([]);

    // Helper to parse "YYYY-MM-DD" string as local date (00:00:00)
    // Prevents timezone issues where new Date("2026-02-28") might become Feb 27th in certain TZs
    const parseLocalDate = (dateStr: string) => {
        if (!dateStr) return new Date();
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        }
        return new Date(dateStr);
    };

    // Initialize selected venues
    useEffect(() => {
        if (venues.length > 0 && selectedVenues.length === 0) {
            const allIds = venues.map(v => v.id);
            setSelectedVenues(allIds);
            onVenueFilterChange?.(allIds);
        }
    }, [venues]);

    const handleVenueToggle = (venueId: string) => {
        const newSelection = selectedVenues.includes(venueId)
            ? selectedVenues.filter(id => id !== venueId)
            : [...selectedVenues, venueId];

        setSelectedVenues(newSelection);
        onVenueFilterChange?.(newSelection);
    };

    // Calculate the start of the current view range
    const viewRange = useMemo(() => {
        switch (view) {
            case 'day':
                return { start: startOfDay(date), end: startOfDay(date), days: [date] };
            case 'week': {
                const start = startOfWeek(date, { weekStartsOn: 0 });
                const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
                return { start, end: addDays(start, 6), days };
            }
            case 'month': {
                const start = startOfWeek(startOfMonth(date), { weekStartsOn: 0 });
                const end = endOfWeek(endOfMonth(date), { weekStartsOn: 0 });
                const days = eachDayOfInterval({ start, end });
                return { start, end, days };
            }
            case 'year': {
                return { start: startOfYear(date), end: endOfYear(date), days: [] };
            }
        }
    }, [date, view]);

    // Scroll to 8 AM on initial load (for day/week views)
    useEffect(() => {
        if ((view === 'week' || view === 'day') && containerRef.current) {
            const eightAM = 8 * 60;
            containerRef.current.scrollTop = eightAM;
        }
    }, [view]);

    const navigate = (direction: 'prev' | 'next') => {
        const multiplier = direction === 'prev' ? -1 : 1;
        switch (view) {
            case 'day': setDate(addDays(date, 1 * multiplier)); break;
            case 'week': setDate(addDays(date, 7 * multiplier)); break;
            case 'month': setDate(addMonths(date, 1 * multiplier)); break;
            case 'year': setDate(addYears(date, 1 * multiplier)); break;
        }
    };

    const goToToday = () => setDate(new Date());

    // Helper: Position styles for Time Grid (Day/Week)
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
            switch (session) {
                case 'MORNING': startHour = 8; durationMinutes = 4 * 60; break;
                case 'AFTERNOON': startHour = 13; durationMinutes = 4 * 60; break;
                case 'EVENING': startHour = 18; durationMinutes = 4 * 60; break;
                case 'FULL_DAY': startHour = 8; durationMinutes = 14 * 60; break;
            }
        }

        const top = startHour * 60;
        const height = (durationMinutes / 60) * 60;
        return { top: `${top}px`, height: `${height}px` };
    };

    const getVenueColor = (venueId: string) => {
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

    // Helper to format time range securely
    const formatBookingTime = (booking: Booking) => {
        const formatTime = (timeStr?: string) => {
            if (!timeStr) return '';
            const [h, m] = timeStr.split(':').map(Number);
            const date = new Date();
            date.setHours(h, m);
            return format(date, 'h:mm a');
        };

        if (booking.startTime && booking.endTime) {
            return `${formatTime(booking.startTime)} - ${formatTime(booking.endTime)}`;
        }

        // Fallback for legacy sessions
        const sessionMap: Record<string, string> = {
            'MORNING': '8:00 AM - 12:00 PM',
            'AFTERNOON': '1:00 PM - 5:00 PM',
            'EVENING': '6:00 PM - 10:00 PM',
            'FULL_DAY': '8:00 AM - 10:00 PM'
        };
        return sessionMap[booking.session || ''] || booking.session || '';
    };

    const getBookingContent = (booking: Booking, venue: Venue, compact = false, canSeeDetails = true) => {
        return (
            <div className="flex flex-col h-full overflow-hidden">
                <div className="font-semibold truncate leading-tight text-[11px] sm:text-xs">
                    {canSeeDetails ? booking.purpose : "Booked"}
                </div>
                {!compact && (
                    <>
                        <div className="text-[10px] opacity-80 truncate flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {formatBookingTime(booking)}
                        </div>
                        <div className="text-[10px] font-medium opacity-90 truncate mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {venue?.name}
                        </div>
                    </>
                )}
            </div>
        )
    };

    // ... (inside component)




    // Helper to get time in Asia/Kuala_Lumpur
    const getAsianTime = () => {
        const now = new Date();
        const timeString = now.toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" });
        return new Date(timeString);
    };

    const asianTime = getAsianTime();
    const currentHour = getHours(asianTime);
    const currentMinute = getMinutes(asianTime);

    // Helper: Calculate layout for overlapping events
    const calculateLayout = (bookings: Booking[]) => {
        // 1. Sort by start time, then end time
        const sorted = [...bookings].sort((a, b) => {
            const getMins = (bk: Booking) => {
                if (bk.startTime) {
                    const [h, m] = bk.startTime.split(':').map(Number);
                    return h * 60 + m;
                }
                // Fallback for sessions
                if (bk.session === 'MORNING') return 8 * 60;
                if (bk.session === 'AFTERNOON') return 13 * 60;
                if (bk.session === 'EVENING') return 18 * 60;
                return 8 * 60;
            };
            return getMins(a) - getMins(b);
        });

        const layout: Record<string, { left: string; width: string }> = {};
        const columns: Booking[][] = [];

        sorted.forEach(booking => {
            // Find the first column where this booking fits without overlap
            let placed = false;
            for (let i = 0; i < columns.length; i++) {
                const col = columns[i];
                const lastInCol = col[col.length - 1];

                // Get end time of last booking in column
                const getEndMins = (bk: Booking) => {
                    if (bk.endTime) {
                        const [h, m] = bk.endTime.split(':').map(Number);
                        return h * 60 + m;
                    }
                    if (bk.session === 'MORNING') return 12 * 60;
                    if (bk.session === 'AFTERNOON') return 17 * 60;
                    if (bk.session === 'EVENING') return 22 * 60;
                    return 22 * 60;
                };

                const getStartMins = (bk: Booking) => {
                    if (bk.startTime) {
                        const [h, m] = bk.startTime.split(':').map(Number);
                        return h * 60 + m;
                    }
                    if (bk.session === 'MORNING') return 8 * 60;
                    if (bk.session === 'AFTERNOON') return 13 * 60;
                    if (bk.session === 'EVENING') return 18 * 60;
                    return 8 * 60;
                }

                if (getEndMins(lastInCol) <= getStartMins(booking)) {
                    col.push(booking);
                    placed = true;
                    // We calculate precise width/left later, but for now assign column index
                    // Actually, simple column assignment isn't enough for complex overlaps like "Brick Layout"
                    // But for simple "Columns" approach where overlapping groups share width:
                    break;
                }
            }
            if (!placed) {
                columns.push([booking]);
            }
        });

        // Simple grid strategy: if we have N columns at any point, width is 100/N %
        // BUT, simplified approach for now:
        // Divide width by total columns found for the day (simplest) or per overlapping group (better)
        // Let's use the simple "overlapping group" logic if possible, or just strict columns for today.

        // Strict columns for the entire set of overlapping events is easier to implement reliably without a full graph coloring algo.
        // If columns.length is 2, all events in col 0 get left:0%, width:50%. events in col 1 get left:50%, width:50%.

        const totalCols = columns.length;
        columns.forEach((col, colIndex) => {
            col.forEach(booking => {
                layout[booking.id] = {
                    left: `${(colIndex / totalCols) * 100}%`,
                    width: `${98 / totalCols}%` // slightly less than 100/N to show gap
                };
            });
        });

        return layout;
    };

    // State for clicked booking details
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

    return (
        <div className="flex flex-col h-full bg-background rounded-lg border shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-b gap-4">
                <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center border rounded-md bg-card">
                            <Button variant="ghost" size="icon" onClick={() => navigate('prev')} className="h-8 w-8">
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={goToToday} className="h-8 px-2 text-xs font-medium border-x rounded-none">
                                Today
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => navigate('next')} className="h-8 w-8">
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                        <h2 className="text-lg sm:text-xl font-semibold whitespace-nowrap ml-2">
                            {view === 'year' ? format(date, 'yyyy') : format(date, 'MMMM yyyy')}
                        </h2>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 gap-2">
                                <Filter className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Venues</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Filter Venues</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {venues.map(venue => (
                                <DropdownMenuCheckboxItem
                                    key={venue.id}
                                    checked={selectedVenues.includes(venue.id)}
                                    onCheckedChange={() => handleVenueToggle(venue.id)}
                                >
                                    {venue.name}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="hidden sm:block h-6 w-px bg-border mx-1" />

                    <div className="flex items-center bg-muted p-1 rounded-md">
                        {(['day', 'week', 'month', 'year'] as const).map((v) => (
                            <button
                                key={v}
                                onClick={() => setView(v)}
                                className={cn(
                                    "px-3 py-1 text-xs font-medium rounded-sm transition-all capitalize",
                                    view === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/50"
                                )}
                            >
                                {v}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Views Content */}
            <div className="flex-1 overflow-hidden flex flex-col">

                {/* DAY & WEEK VIEW */}
                {(view === 'day' || view === 'week') && (
                    <div ref={containerRef} className="flex-1 overflow-y-auto relative bg-background">
                        {/* Sticky Header */}
                        <div className="sticky top-0 z-30 flex bg-card border-b shadow-sm">
                            {/* Empty corner for Time Axis */}
                            <div className="w-12 sm:w-16 flex-shrink-0 border-r bg-background" />
                            {/* Days Header */}
                            <div className="flex-1 flex">
                                {viewRange.days?.map((day, i) => (
                                    <div key={i} className={cn(
                                        "flex-1 flex flex-col items-center justify-center py-2 border-r last:border-r-0 min-w-[50px]",
                                        isToday(day) && "bg-primary/5"
                                    )}>
                                        <span className={cn(
                                            "text-[10px] sm:text-xs font-medium uppercase text-muted-foreground mb-0.5",
                                            isToday(day) && "text-primary"
                                        )}>
                                            {format(day, 'EEE')}
                                        </span>
                                        <div className={cn(
                                            "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold",
                                            isToday(day) ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                                        )}>
                                            {format(day, 'd')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex min-h-[1440px] relative">
                            {/* Time Axis Column - Using absolute positioning for labels */}
                            <div className="w-12 sm:w-16 flex-shrink-0 border-r bg-muted/5 relative pointer-events-none z-10">
                                {HOURS.map(hour => {
                                    if (hour === 0) return null; // Skip 00:00 at top logic or handle differently
                                    return (
                                        <div
                                            key={hour}
                                            className="absolute w-full text-right pr-2 text-[10px] sm:text-xs text-muted-foreground font-medium"
                                            style={{ top: `${hour * 60}px`, transform: 'translateY(-50%)' }}
                                        >
                                            {format(setHours(new Date(), hour), 'h a')}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Main Grid Content */}
                            <div className="flex-1 relative">
                                {/* Horizontal Guidelines */}
                                <div className="absolute inset-0 flex flex-col pointer-events-none">
                                    {HOURS.map(hour => (
                                        <div key={hour} className="h-[60px] border-b border-border/40 w-full" />
                                    ))}
                                </div>

                                {/* Event Columns */}
                                <div className="absolute inset-0 flex">
                                    {viewRange.days?.map((day, dayIndex) => {
                                        const dayBookings = bookings.filter(b => isSameDay(parseLocalDate(b.date), day));
                                        const visibleBookings = dayBookings.filter(b => selectedVenues.includes(b.venueId));

                                        // Calculate layout for overlaps
                                        const overlapLayout = calculateLayout(visibleBookings);

                                        return (
                                            <div key={dayIndex} className="flex-1 border-r last:border-r-0 relative group/day">
                                                {/* Current Time Indicator */}
                                                {isToday(day) && (
                                                    <div
                                                        className="absolute w-full border-t-2 border-red-500 z-40 pointer-events-none flex items-center"
                                                        style={{ top: `${(currentHour * 60) + currentMinute}px` }}
                                                    >
                                                        <div className="w-2 h-2 rounded-full bg-red-500 -ml-1"></div>
                                                    </div>
                                                )}

                                                {/* Bookings */}
                                                {visibleBookings.map((booking) => {
                                                    const venue = venues.find(v => v.id === booking.venueId);
                                                    if (!venue) return null;

                                                    const position = getPositionStyle(booking.startTime, booking.endTime, booking.session);
                                                    const layoutStyle = overlapLayout[booking.id] || { left: '0%', width: '100%' };

                                                    const isMyBooking = booking.userId === currentUserId;
                                                    const canSeeDetails = currentUserRole === 'ADMIN' || isMyBooking;

                                                    return (
                                                        <div
                                                            key={booking.id}
                                                            onClick={() => setSelectedBooking(booking)}
                                                            className={cn(
                                                                "absolute rounded border-l-4 p-1 text-xs transition-all cursor-pointer shadow-sm overflow-hidden hover:z-50 hover:shadow-md hover:ring-1 hover:ring-ring",
                                                                getVenueColor(booking.venueId),
                                                                !canSeeDetails && "opacity-80 grayscale"
                                                            )}
                                                            style={{
                                                                ...position,
                                                                left: layoutStyle.left,
                                                                width: layoutStyle.width
                                                            }}
                                                        >
                                                            {getBookingContent(booking, venue, false, canSeeDetails)}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* MONTH VIEW */}
                {view === 'month' && (
                    <div className="flex flex-col flex-1 overflow-hidden bg-muted/10">
                        {/* ScrollContainer for Month View to ensure header aligns with grid scrollbar */}
                        <div className="flex-1 overflow-y-auto">
                            {/* Sticky Days Header */}
                            <div className="grid grid-cols-7 border-b bg-card sticky top-0 z-10 shadow-sm">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                    <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground uppercase border-r last:border-r-0">
                                        {day}
                                    </div>
                                ))}
                            </div>
                            {/* Month Grid */}
                            <div className="grid grid-cols-7 grid-rows-5 min-h-[600px]">
                                {viewRange.days?.map((day, i) => {
                                    const isMonthStart = isSameDay(day, startOfMonth(date)); // Highlight 1st day of month
                                    const isCurrentMonth = isSameMonth(day, date);
                                    const dayBookings = bookings.filter(b => isSameDay(parseLocalDate(b.date), day) && selectedVenues.includes(b.venueId) && b.status !== 'REJECTED'); // Filter rejected and venue

                                    return (
                                        <div key={i} className={cn(
                                            "border-b border-r p-1 min-h-[100px] flex flex-col gap-1 transition-colors hover:bg-card/50",
                                            !isCurrentMonth && "bg-muted/30 text-muted-foreground",
                                            isToday(day) && "bg-primary/5"
                                        )}>
                                            <div className="flex justify-center">
                                                <span className={cn(
                                                    "text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full",
                                                    isToday(day) && "bg-primary text-primary-foreground"
                                                )}>
                                                    {format(day, 'd')}
                                                </span>
                                            </div>

                                            <div className="flex flex-col gap-1 px-1 mt-1">
                                                {dayBookings.slice(0, 4).map(booking => {
                                                    const venue = venues.find(v => v.id === booking.venueId);
                                                    return (
                                                        <div
                                                            key={booking.id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedBooking(booking);
                                                            }}
                                                            className={cn(
                                                                "text-[10px] px-1.5 py-1 rounded border overflow-hidden cursor-pointer hover:opacity-80 flex flex-col gap-0.5",
                                                                getVenueColor(booking.venueId),
                                                                "border-l-2"
                                                            )}
                                                            title={`${booking.purpose} (${formatBookingTime(booking)})`}
                                                        >
                                                            <div className="flex justify-between items-center gap-1">
                                                                <span className="font-bold truncate">{booking.purpose}</span>
                                                            </div>
                                                            <div className="opacity-90 font-medium truncate text-[9px] flex items-center gap-1">
                                                                <Clock className="w-2.5 h-2.5" />
                                                                {formatBookingTime(booking)}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                                {dayBookings.length > 4 && (
                                                    <div className="text-[10px] text-center text-muted-foreground font-medium">
                                                        +{dayBookings.length - 4} more
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* YEAR VIEW */}
                {view === 'year' && (
                    <ScrollArea className="flex-1 p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {eachMonthOfInterval({ start: startOfYear(date), end: endOfYear(date) }).map((monthDate, i) => (
                                <div key={i} className="border rounded-lg p-4 bg-card shadow-sm h-full">
                                    <h3 className="font-semibold text-center mb-3 text-sm">{format(monthDate, 'MMMM')}</h3>
                                    <div className="grid grid-cols-7 gap-y-2 gap-x-1 text-center">
                                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                                            <div key={d} className="text-[10px] text-muted-foreground font-medium">{d}</div>
                                        ))}
                                        {/* Blank slots for start of month */}
                                        {Array.from({ length: startOfWeek(monthDate).getDay() }).map((_, idx) => (
                                            <div key={`empty-${idx}`} />
                                        ))}
                                        {/* Days */}
                                        {eachDayOfInterval({ start: startOfMonth(monthDate), end: endOfMonth(monthDate) }).map(day => {
                                            const dayBookings = bookings.filter(b => isSameDay(parseLocalDate(b.date), day) && selectedVenues.includes(b.venueId) && b.status !== 'REJECTED');
                                            const hasEvents = dayBookings.length > 0;

                                            return (
                                                <div
                                                    key={day.toISOString()}
                                                    className={cn(
                                                        "text-xs p-1 rounded-full w-6 h-6 flex items-center justify-center mx-auto cursor-pointer hover:bg-muted",
                                                        isToday(day) && "border border-primary font-bold text-primary",
                                                        hasEvents && !isToday(day) && "bg-primary/10 font-semibold text-primary"
                                                    )}
                                                    onClick={() => {
                                                        setDate(day);
                                                        setView('day');
                                                    }}
                                                >
                                                    {format(day, 'd')}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </div>

            {/* DETAILS DIALOG */}
            {selectedBooking && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in-0">
                    <div className="bg-card w-full max-w-sm rounded-lg border shadow-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b flex justify-between items-start bg-muted/20">
                            <div>
                                <h3 className="font-semibold text-lg leading-tight">{selectedBooking.purpose}</h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Booked by {(currentUserRole === 'ADMIN' || selectedBooking.userId === currentUserId) ? selectedBooking.userName : "Hidden User"}
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 -mr-2 -mt-2 opacity-70 hover:opacity-100"
                                onClick={() => setSelectedBooking(null)}
                            >
                                <Check className="w-4 h-4 sr-only" />
                                {/* Using generic 'X' close visual or just clicking outside logic if implemented, but manual button is safer */}
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                            </Button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="flex items-center gap-3 text-sm">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                                    <Clock className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="font-medium">Time & Date</p>
                                    <p className="text-muted-foreground text-xs">
                                        {format(parseLocalDate(selectedBooking.date), 'EEEE, MMM d, yyyy')}
                                    </p>
                                    <p className="text-muted-foreground text-xs font-mono mt-0.5">
                                        {selectedBooking.startTime && selectedBooking.endTime
                                            ? `${selectedBooking.startTime} - ${selectedBooking.endTime}`
                                            : selectedBooking.session?.replace('_', ' ') || 'N/A'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 text-sm">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                                    <MapPin className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="font-medium">Venue</p>
                                    <p className="text-muted-foreground text-xs">
                                        {venues.find(v => v.id === selectedBooking.venueId)?.name || 'Unknown Venue'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 text-sm">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                                    <Filter className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="font-medium">Status</p>
                                    <div className={cn(
                                        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                                        selectedBooking.status === 'APPROVED' && "border-transparent bg-green-500 text-white shadow hover:bg-green-600",
                                        selectedBooking.status === 'PENDING' && "border-transparent bg-amber-500 text-white shadow hover:bg-amber-600",
                                        selectedBooking.status === 'REJECTED' && "border-transparent bg-red-500 text-white shadow hover:bg-red-600",
                                        selectedBooking.status === 'CANCELLED' && "border-transparent bg-gray-500 text-white shadow hover:bg-gray-600",
                                    )}>
                                        {selectedBooking.status}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t bg-muted/20 flex justify-end">
                            <Button variant="outline" size="sm" onClick={() => setSelectedBooking(null)}>
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
