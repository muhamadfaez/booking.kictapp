import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, MapPin, ArrowRight, Wifi, Monitor, Coffee } from "lucide-react";
import type { Venue } from "@shared/types";

interface VenueCardProps {
  venue: Venue;
  onBook: (venue: Venue) => void;
}

const amenityIcons: Record<string, React.ElementType> = {
  'wifi': Wifi,
  'projector': Monitor,
  'coffee': Coffee,
};

export function VenueCard({ venue, onBook }: VenueCardProps) {
  return (
    <Card className="group overflow-hidden border-0 shadow-sm hover:shadow-xl transition-all duration-500 bg-card">
      {/* Image Container */}
      <div className="aspect-[4/3] relative overflow-hidden">
        <img
          src={venue.imageUrl}
          alt={venue.name}
          className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-110"
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {/* Capacity Badge */}
        <Badge className="absolute top-4 right-4 bg-white/95 dark:bg-black/80 backdrop-blur-sm text-foreground hover:bg-white/100 shadow-lg border-0 px-3 py-1.5">
          <Users className="w-4 h-4 mr-1.5" />
          <span className="font-semibold">{venue.capacity}</span>
        </Badge>

        {/* Hover Quick Book Button */}
        <div className="absolute bottom-4 left-4 right-4 opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onBook(venue);
            }}
            className="w-full btn-gradient rounded-xl shadow-2xl"
          >
            Quick Book
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>
      </div>

      <CardHeader className="p-5 pb-3">
        <div className="flex justify-between items-start gap-2">
          <div className="space-y-1.5">
            <CardTitle className="text-xl font-bold leading-tight group-hover:text-primary transition-colors duration-300">
              {venue.name}
            </CardTitle>
            <div className="flex items-center text-sm text-muted-foreground">
              <MapPin className="w-4 h-4 mr-1.5 text-primary/70" />
              {venue.location}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-0 space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
          {venue.description}
        </p>

        {/* Amenities - with safe check for undefined */}
        {venue.amenities && venue.amenities.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {venue.amenities.slice(0, 4).map((amenity) => (
              <Badge
                key={amenity}
                variant="secondary"
                className="text-xs px-2.5 py-1 bg-secondary/80 hover:bg-secondary font-medium"
              >
                {amenity}
              </Badge>
            ))}
            {venue.amenities.length > 4 && (
              <Badge
                variant="outline"
                className="text-xs px-2.5 py-1 font-medium"
              >
                +{venue.amenities.length - 4} more
              </Badge>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="p-5 pt-0">
        <Button
          onClick={() => onBook(venue)}
          variant="outline"
          className="w-full h-11 rounded-xl border-2 hover:border-primary hover:bg-primary/5 font-semibold transition-all duration-300 group/btn"
        >
          <span>Reserve Now</span>
          <ArrowRight className="ml-2 w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
        </Button>
      </CardFooter>
    </Card>
  );
}