import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock3,
  Filter,
  MapPin,
  Search,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react';
import { format, differenceInMinutes, parse } from 'date-fns';

import { LoginDialog } from '@/components/auth/LoginDialog';
import { BookingWizard } from '@/components/booking/BookingWizard';
import { VenueCard } from '@/components/booking/VenueCard';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useAppSettings } from '@/hooks/useAppSettings';
import { usePageTheme } from '@/hooks/use-page-theme';
import { api } from '@/lib/api-client';
import type { Venue } from '@shared/types';

type AvailabilityResult = {
  availableVenueIds: string[];
  unavailableVenueIds: string[];
};

const operationalSignals = [
  {
    icon: Shield,
    title: 'Governed approvals',
    description: 'Role-aware approval flows keep academic and administrative bookings transparent.',
  },
  {
    icon: Calendar,
    title: 'Time-based planning',
    description: 'Exact start and end times make the booking search feel closer to real scheduling.',
  },
  {
    icon: Clock3,
    title: 'Fast availability checks',
    description: 'Users can evaluate supply for a selected date and time window before committing.',
  },
];

export default function LandingPage() {
  usePageTheme('dark');

  const { user } = useAuth();
  const navigate = useNavigate();
  const { settings } = useAppSettings();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedStartTime, setSelectedStartTime] = useState('08:00');
  const [selectedEndTime, setSelectedEndTime] = useState('10:00');
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [showLoginDialog, setShowLoginDialog] = useState(false);

  const { data: venues, isLoading } = useQuery({
    queryKey: ['venues'],
    queryFn: () => api<Venue[]>('/api/venues')
  });

  const { data: availability } = useQuery({
    queryKey: ['venues-availability', selectedDate, selectedStartTime, selectedEndTime],
    queryFn: () =>
      api<AvailabilityResult>(
        `/api/venues/availability?date=${encodeURIComponent(selectedDate)}&startTime=${encodeURIComponent(selectedStartTime)}&endTime=${encodeURIComponent(selectedEndTime)}`
      ),
    enabled: selectedStartTime < selectedEndTime,
  });

  const heroImageUrl = settings.heroImageUrl || '/images/hero-painting.jpg';

  const availableSet = useMemo(() => new Set(availability?.availableVenueIds ?? []), [availability?.availableVenueIds]);

  const filteredVenues = useMemo(
    () =>
      venues?.filter((venue) =>
        venue.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        venue.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        venue.description.toLowerCase().includes(searchQuery.toLowerCase())
      ) ?? [],
    [searchQuery, venues]
  );

  const displayedVenues = useMemo(
    () =>
      filteredVenues.filter((venue) => {
        if (venue.isAvailable === false) return true;
        return availableSet.size === 0 || availableSet.has(venue.id);
      }),
    [availableSet, filteredVenues]
  );

  const totalCapacity = useMemo(
    () => (venues ?? []).reduce((sum, venue) => sum + venue.capacity, 0),
    [venues]
  );

  const activeVenueCount = useMemo(
    () => (venues ?? []).filter((venue) => venue.isAvailable !== false).length,
    [venues]
  );

  const selectedTimeWindow = useMemo(() => `${selectedStartTime} - ${selectedEndTime}`, [selectedEndTime, selectedStartTime]);

  const selectedDuration = useMemo(() => {
    if (selectedStartTime >= selectedEndTime) return 'Invalid window';
    const start = parse(selectedStartTime, 'HH:mm', new Date());
    const end = parse(selectedEndTime, 'HH:mm', new Date());
    const minutes = differenceInMinutes(end, start);
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    if (hours === 0) return `${remainder} min`;
    if (remainder === 0) return `${hours} hr`;
    return `${hours} hr ${remainder} min`;
  }, [selectedEndTime, selectedStartTime]);

  const handleBookVenue = (venue: Venue) => {
    if (!user) {
      setShowLoginDialog(true);
      return;
    }
    setSelectedVenue(venue);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-primary shadow-lg">
              {settings.appIconUrl ? (
                <img src={settings.appIconUrl} alt={settings.appName} className="h-full w-full rounded-2xl object-cover" />
              ) : (
                <Building2 className="h-5 w-5 text-white" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight">{settings.appName}</span>
              <span className="hidden text-[10px] uppercase tracking-[0.24em] text-muted-foreground sm:block">
                {settings.appLabel}
              </span>
            </div>
          </div>

          <nav className="flex items-center gap-2">
            <ThemeToggle />
            {!user ? (
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-primary/20 px-5"
                onClick={() => setShowLoginDialog(true)}
              >
                Sign In
              </Button>
            ) : (
              <Button size="sm" className="rounded-full px-5" onClick={() => navigate('/dashboard')}>
                Go to Dashboard
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-mesh opacity-80" />
          <div className="absolute left-[-8rem] top-24 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute right-[-6rem] top-10 h-64 w-64 rounded-full bg-emerald-300/20 blur-3xl" />

          <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-7xl grid-cols-1 gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-8 lg:py-16">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                IIUM KICT Venue Command Center
              </div>

              <div className="space-y-5">
                <h1 className="max-w-4xl text-5xl font-bold leading-[0.95] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
                  Quietly find the right room,
                  <span className="block text-gradient">then move when you are ready.</span>
                </h1>
                <p className="max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
                  A calmer front door for lecture rooms, labs, halls, and shared spaces across KICT.
                  Search lightly, scan the time window, and only step in when the room feels right.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]">
                <div className="glass-strong rounded-[2rem] p-4 shadow-[0_25px_80px_-35px_rgba(0,122,94,0.45)]">
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    <Search className="h-3.5 w-3.5 text-primary" />
                    Instant venue scan
                  </div>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground transition-colors" />
                    <Input
                      type="text"
                      placeholder="Search room name, venue type, or location"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-16 rounded-2xl border-0 bg-transparent pl-12 text-base shadow-none focus-visible:ring-0"
                    />
                  </div>
                </div>

                <Card className="overflow-hidden rounded-[2rem] border-primary/10 bg-gradient-to-br from-primary/95 via-primary to-emerald-500 text-primary-foreground shadow-[0_25px_80px_-35px_rgba(0,122,94,0.8)]">
                  <div className="p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-foreground/70">
                      Live inventory
                    </p>
                    <div className="mt-4 flex items-end gap-3">
                      <span className="text-4xl font-bold">{activeVenueCount}</span>
                      <span className="pb-1 text-sm text-primary-foreground/80">active spaces</span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-primary-foreground/80">
                      Capacity for {totalCapacity.toLocaleString()} people across the current venue catalog.
                    </p>
                  </div>
                </Card>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <SignalCard label="Visible now" value={`${displayedVenues.length}`} meta="matching venues" />
                <SignalCard label="Time window" value={selectedTimeWindow} meta={selectedDuration} />
                <SignalCard label="Trust layer" value="Approval-ready" meta={selectedDate} />
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-primary/20 via-transparent to-emerald-300/20 blur-3xl" />
              <div className="relative overflow-hidden rounded-[2.5rem] border border-white/40 bg-card shadow-[0_40px_120px_-50px_rgba(15,23,42,0.55)]">
                <div className="relative aspect-[4/5] overflow-hidden">
                  <img src={heroImageUrl} alt="KICT campus venue" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/25 to-transparent" />

                  <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                    <div className="glass rounded-[2rem] p-5 text-white shadow-2xl">
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70">
                            Quick planning panel
                          </p>
                          <h2 className="mt-2 text-2xl font-bold leading-tight">Choose a day. Set a window. Keep it simple.</h2>
                        </div>
                        <div className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-white/15 sm:flex">
                          <Calendar className="h-5 w-5" />
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <Input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          className="h-12 rounded-xl border-white/20 bg-white/10 text-white [color-scheme:dark] placeholder:text-white/60"
                        />
                        <Input
                          type="time"
                          value={selectedStartTime}
                          onChange={(e) => setSelectedStartTime(e.target.value)}
                          className="h-12 rounded-xl border-white/20 bg-white/10 text-white [color-scheme:dark]"
                        />
                        <Input
                          type="time"
                          value={selectedEndTime}
                          onChange={(e) => setSelectedEndTime(e.target.value)}
                          className="h-12 rounded-xl border-white/20 bg-white/10 text-white [color-scheme:dark]"
                        />
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <QuickMetric
                          label="Available"
                          value={selectedStartTime < selectedEndTime ? `${availability?.availableVenueIds.length ?? activeVenueCount}` : 'Fix time'}
                        />
                        <QuickMetric label="Date" value={format(new Date(selectedDate), 'dd MMM')} />
                        <QuickMetric label="Window" value={selectedDuration} />
                      </div>

                      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                        <Button
                          className="h-12 flex-1 rounded-xl bg-white text-primary hover:bg-white/90"
                          onClick={() => {
                            if (user) {
                              navigate('/dashboard');
                              return;
                            }
                            setShowLoginDialog(true);
                          }}
                        >
                          {user ? 'Open Dashboard' : 'Sign In to Reserve'}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          className="h-12 rounded-xl border-white/25 bg-white/5 text-white hover:bg-white/10"
                          onClick={() => document.getElementById('venue-directory')?.scrollIntoView({ behavior: 'smooth' })}
                        >
                          Browse Venues
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-4 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            {operationalSignals.map((signal, index) => (
              <Card
                key={signal.title}
                className="card-premium border-border/50 bg-card/80 p-6 backdrop-blur-sm"
                style={{ animationDelay: `${index * 0.08}s` }}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <signal.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight">{signal.title}</h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{signal.description}</p>
              </Card>
            ))}
          </div>
        </section>

        <section id="venue-directory" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Venue directory
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Pick a space that suits the hour, not just the day.</h2>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                The grid below responds to your selected date and time window. Closed venues remain visible for planning,
                but bookable spaces stay prioritized.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[32rem]">
              <InfoTile label="Shown" value={`${displayedVenues.length}`} />
              <InfoTile label="Catalog" value={`${venues?.length ?? 0}`} />
              <InfoTile label="Window" value={selectedDuration} />
            </div>
          </div>

          <div className="mb-8 rounded-[2rem] border border-border/60 bg-card/80 p-4 shadow-sm backdrop-blur-sm">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_180px_auto]">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search venue name, location, or facility"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-12 rounded-xl pl-10"
                />
              </div>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-12 rounded-xl"
              />
              <Input
                type="time"
                value={selectedStartTime}
                onChange={(e) => setSelectedStartTime(e.target.value)}
                className="h-12 rounded-xl"
              />
              <Input
                type="time"
                value={selectedEndTime}
                onChange={(e) => setSelectedEndTime(e.target.value)}
                className="h-12 rounded-xl"
              />
              <Button variant="outline" className="h-12 rounded-xl gap-2 border-dashed">
                <Filter className="h-4 w-4" />
                Refine
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {isLoading ? (
              Array.from({ length: 8 }, (_, index) => (
                <Card key={index} className="overflow-hidden rounded-[1.75rem] border-0 shadow-sm">
                  <Skeleton className="aspect-[4/3] w-full" />
                  <div className="space-y-3 p-5">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </Card>
              ))
            ) : displayedVenues.length > 0 ? (
              displayedVenues.map((venue, index) => (
                <div key={venue.id} className="animate-fade-in" style={{ animationDelay: `${index * 0.05}s` }}>
                  <VenueCard
                    venue={venue}
                    onBook={handleBookVenue}
                    disabled={venue.isAvailable === false}
                    disabledReason={venue.unavailableReason || 'Closed for maintenance'}
                  />
                </div>
              ))
            ) : (
              <div className="col-span-full rounded-[2rem] border border-dashed border-border bg-muted/20 px-6 py-20 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Search className="h-7 w-7 text-muted-foreground opacity-60" />
                </div>
                <p className="text-lg font-semibold">No venues match this search.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Adjust the search text, date, or time window to widen the result set.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <Card className="overflow-hidden rounded-[2rem] border-0 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-8 text-white shadow-[0_30px_100px_-45px_rgba(15,23,42,0.9)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200/70">
                Operations posture
              </p>
              <h3 className="mt-4 text-3xl font-bold tracking-tight">Built for public discovery, private control, and cleaner scheduling.</h3>
              <p className="mt-4 text-sm leading-7 text-white/75">
                The public-facing experience stays simple, while login, approval, and administrative review can remain
                structured behind the booking workflow.
              </p>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              <DetailCard
                icon={MapPin}
                title="Spatial clarity"
                description="Venue cards emphasize location, capacity, and availability so users can decide faster."
              />
              <DetailCard
                icon={Users}
                title="Community access"
                description="Public discovery remains open while authenticated flows handle booking and approvals."
              />
              <DetailCard
                icon={Calendar}
                title="Time rhythm"
                description="The landing page keeps the active time window visible across hero, filters, and quick stats."
              />
              <DetailCard
                icon={Shield}
                title="Administrative confidence"
                description="The visual language signals reliability instead of looking like a template storefront."
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50 py-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:px-6 md:flex-row lg:px-8">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span>&copy; {new Date().getFullYear()} {settings.appName}. KICT venue booking platform.</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#" className="transition-colors hover:text-foreground">Privacy</a>
            <a href="#" className="transition-colors hover:text-foreground">Terms</a>
            <a href="#" className="transition-colors hover:text-foreground">Support</a>
          </div>
        </div>
      </footer>

      {user ? (
        <BookingWizard
          venue={selectedVenue}
          isOpen={!!selectedVenue}
          onClose={() => setSelectedVenue(null)}
          onSuccess={() => {
            setSelectedVenue(null);
            navigate('/dashboard');
          }}
        />
      ) : null}

      <LoginDialog isOpen={showLoginDialog} onClose={() => setShowLoginDialog(false)} />
    </div>
  );
}

function SignalCard({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <Card className="rounded-[1.75rem] border-border/50 bg-card/70 p-5 backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-lg font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{meta}</p>
    </Card>
  );
}

function QuickMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-[1.5rem] border-border/50 bg-background/80 p-4 shadow-none">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
    </Card>
  );
}

function DetailCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <Card className="card-premium rounded-[1.75rem] border-border/50 p-6">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h4 className="text-lg font-semibold tracking-tight">{title}</h4>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">{description}</p>
    </Card>
  );
}
