import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, MapPin, Sparkles } from "lucide-react";
import type { Venue } from "@shared/types";
interface VenueCardProps {
  venue: Venue;
  onBook: (venue: Venue) => void;
}
export function VenueCard({ venue, onBook }: VenueCardProps) {
  return (
    <Card className="overflow-hidden transition-all hover:shadow-md group">
      <div className="aspect-video relative overflow-hidden">
        <img 
          src={venue.imageUrl} 
          alt={venue.name} 
          className="object-cover w-full h-full transition-transform group-hover:scale-105"
        />
        <Badge className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-foreground hover:bg-background/90">
          <Users className="w-3 h-3 mr-1" />
          {venue.capacity}
        </Badge>
      </div>
      <CardHeader className="p-4 pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-bold">{venue.name}</CardTitle>
        </div>
        <div className="flex items-center text-xs text-muted-foreground mt-1">
          <MapPin className="w-3 h-3 mr-1" />
          {venue.location}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
          {venue.description}
        </p>
        <div className="flex flex-wrap gap-1 mt-3">
          {venue.amenities.slice(0, 3).map(a => (
            <Badge key={a} variant="secondary" className="text-[10px] px-1.5 py-0">
              {a}
            </Badge>
          ))}
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Button 
          onClick={() => onBook(venue)} 
          className="w-full btn-gradient h-9"
        >
          Book Now
        </Button>
      </CardFooter>
    </Card>
  );
}