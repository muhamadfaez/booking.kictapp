import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Users, MapPin, Building2, Search, Filter, ArrowRight, Clock, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VenueCard } from '@/components/booking/VenueCard';
import { BookingWizard } from '@/components/booking/BookingWizard';
import { useAuth } from '@/hooks/useAuth';
import { ThemeToggle } from '@/components/ThemeToggle';
import { api } from '@/lib/api-client';
import type { Venue } from '@shared/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

export default function LandingPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);

  const { data: venues, isLoading } = useQuery({
    queryKey: ['venues'],
    queryFn: () => api<Venue[]>('/api/venues')
  });

  const handleLogin = (role: 'USER' | 'ADMIN') => {
    login(role);
    navigate('/dashboard');
  };

  const handleBookVenue = (venue: Venue) => {
    if (!user) {
      // If not logged in, redirect to login page
      navigate('/login');
      return;
    }
    setSelectedVenue(venue);
  };

  const filteredVenues = venues?.filter(venue =>
    venue.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    venue.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
    venue.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Professional Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 shadow-md">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight">BookingTrack</span>
                <span className="text-[10px] text-muted-foreground hidden sm:block">Professional Venue Management</span>
              </div>
            </div>

            <nav className="flex items-center gap-2">
              <ThemeToggle />
              {!user ? (
                <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
                  Sign In
                </Button>
              ) : (
                <Button size="sm" onClick={() => navigate('/dashboard')}>
                  Go to Dashboard
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Image Section with Overlaid Content */}
      <div className="w-full h-[500px] md:h-[600px] lg:h-[700px] overflow-hidden relative flex items-center justify-center">
        <img
          src="/images/hero-painting.jpg"
          alt="Campus Painting"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

        <div className="relative z-10 container mx-auto px-4 text-center space-y-8">

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight max-w-4xl mx-auto text-white drop-shadow-lg animate-fade-in-up">
            Book Your Perfect{' '}
            <p></p>
            <span className="text-primary-foreground underline decoration-primary decoration-4 underline-offset-8">VENUE</span>
          </h1>

          <p className="text-lg md:text-2xl text-white/90 max-w-2xl mx-auto drop-shadow-md animate-fade-in-up delay-100">
            Discover and reserve professional meeting rooms, conference halls, and collaborative spaces for your team.
          </p>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto pt-4 animate-fade-in-up delay-200">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                type="text"
                placeholder="Search by venue name, location, or amenities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-16 pl-12 pr-4 text-lg rounded-2xl border-0 bg-white/95 backdrop-blur shadow-2xl focus-visible:ring-2 focus-visible:ring-primary transition-all"
              />
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex flex-wrap justify-center gap-8 pt-6 animate-fade-in-up delay-300">
            <div className="flex items-center gap-3 text-white">
              <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
              <span className="font-semibold">{venues?.length || 0} Venues Available</span>
            </div>
            <div className="flex items-center gap-3 text-white">
              <div className="w-3 h-3 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.5)]" />
              <span className="font-semibold">Instant Booking</span>
            </div>
            <div className="flex items-center gap-3 text-white">
              <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
              <span className="font-semibold">24/7 Support</span>
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Venues Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Available Venues</h2>
              <p className="text-muted-foreground mt-1">
                {filteredVenues?.length || 0} {searchQuery ? 'matching' : 'professional'} spaces ready to book
              </p>
            </div>

            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
            </Button>
          </div>

          {/* Venue Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {isLoading ? (
              Array.from({ length: 8 }, (_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="aspect-[4/3] w-full" />
                  <div className="p-5 space-y-3">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </Card>
              ))
            ) : filteredVenues && filteredVenues.length > 0 ? (
              filteredVenues.map((venue, index) => (
                <div
                  key={venue.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <VenueCard venue={venue} onBook={handleBookVenue} />
                </div>
              ))
            ) : (
              <div className="col-span-full py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-muted-foreground opacity-50" />
                </div>
                <p className="text-lg font-medium text-muted-foreground">No venues found</p>
                <p className="text-sm text-muted-foreground mt-1">Try adjusting your search criteria</p>
              </div>
            )}
          </div>
        </section>

        {/* Features Section */}
        <section className="mt-20 mb-12">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">Why Choose BookingTrack?</h2>
            <p className="text-muted-foreground">Professional features for seamless workspace management</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Calendar,
                title: 'Easy Scheduling',
                description: 'Book venues in seconds with our intuitive calendar interface and real-time availability.',
              },
              {
                icon: Shield,
                title: 'Secure & Reliable',
                description: 'Enterprise-grade security with atomic booking integrity and zero overbooking guarantee.',
              },
              {
                icon: Clock,
                title: 'Instant Confirmation',
                description: 'Get immediate booking confirmations and automated notifications for all your reservations.',
              },
            ].map((feature, index) => (
              <Card
                key={feature.title}
                className="p-6 hover:shadow-lg transition-all duration-300 animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </Card>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 mt-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                &copy; 2024 BookingTrack. Professional Venue Management.
              </span>
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="hover:text-foreground transition-colors">Support</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Booking Wizard */}
      {user && (
        <BookingWizard
          venue={selectedVenue}
          isOpen={!!selectedVenue}
          onClose={() => setSelectedVenue(null)}
          onSuccess={() => {
            setSelectedVenue(null);
            navigate('/dashboard');
          }}
        />
      )}
    </div>
  );
}