import React from 'react';
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Venue } from "@shared/types";
import { CalendarDays, Filter } from "lucide-react";

interface ScheduleSidebarProps {
    date: Date | undefined;
    setDate: (date: Date | undefined) => void;
    venues: Venue[];
    selectedVenues: string[];
    toggleVenue: (venueId: string) => void;
}

export function ScheduleSidebar({
    date,
    setDate,
    venues,
    selectedVenues,
    toggleVenue
}: ScheduleSidebarProps) {
    return (
        <div className="w-full md:w-80 flex-shrink-0 space-y-6">
            {/* Calendar Card */}
            <Card className="border-none shadow-md overflow-hidden">
                <CardHeader className="bg-primary/5 pb-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <CalendarDays className="w-5 h-5 text-primary" />
                        Select Date
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-3 flex justify-center bg-card">
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        className="rounded-md border shadow-sm"
                    />
                </CardContent>
            </Card>

            {/* Resources Card */}
            <Card className="border-none shadow-md flex flex-col h-[calc(100vh-500px)] min-h-[300px]">
                <CardHeader className="bg-primary/5 pb-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Filter className="w-5 h-5 text-primary" />
                        Resources
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex-1">
                    <ScrollArea className="h-full px-4 py-4">
                        <div className="space-y-4">
                            <div className="flex items-center space-x-2 pb-2 border-b">
                                <Checkbox
                                    id="all"
                                    checked={selectedVenues.length === venues.length && venues.length > 0}
                                    onCheckedChange={(checked) => {
                                        if (checked) {
                                            venues.forEach(v => {
                                                if (!selectedVenues.includes(v.id)) toggleVenue(v.id);
                                            });
                                        } else {
                                            selectedVenues.forEach(id => toggleVenue(id));
                                        }
                                    }}
                                />
                                <Label htmlFor="all" className="font-semibold cursor-pointer">Select All Resources</Label>
                            </div>

                            {venues.map((venue) => (
                                <div key={venue.id} className="flex items-start space-x-3 p-2 rounded-lg hover:bg-accent/50 transition-colors">
                                    <Checkbox
                                        id={venue.id}
                                        checked={selectedVenues.includes(venue.id)}
                                        onCheckedChange={() => toggleVenue(venue.id)}
                                    />
                                    <div className="grid gap-1.5 leading-none">
                                        <Label
                                            htmlFor={venue.id}
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                        >
                                            {venue.name}
                                        </Label>
                                        <p className="text-xs text-muted-foreground line-clamp-1">
                                            {venue.location}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
