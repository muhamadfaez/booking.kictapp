import React, { Suspense, lazy, startTransition, useDeferredValue, useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Calendar,
  Clock,
  MapPin,
  Users,
  Shield,
  Sparkles,
  ArrowRight,
  Building2,
  CheckCircle2,
  Filter,
  Monitor,
  Coffee,
  Mic2,
  Zap
} from 'lucide-react';

import { ThemeToggle } from '@/components/ThemeToggle';
import { Card } from '@/components/ui/card';
import { SafeImage } from '@/components/ui/safe-image';
import { useAuth } from '@/hooks/useAuth';
import { useAppSettings } from '@/hooks/useAppSettings';
import { usePageTheme } from '@/hooks/use-page-theme';
import { usePageTitle } from '@/hooks/use-page-title';
import { api } from '@/lib/api-client';
import { preloadLandingOverlays, preloadRoute } from '@/lib/route-preload';
import type { Venue } from '@shared/types';

type AvailabilityResult = {
  availableVenueIds: string[];
  unavailableVenueIds: string[];
};

const SIGNALS = [
  { icon: Shield, title: 'Governed Approvals', desc: 'Role-aware flows for academic transparency.' },
  { icon: Clock, title: 'Real-time Windows', desc: 'Precise scheduling to avoid double bookings.' },
  { icon: Zap, title: 'Instant Confirmation', desc: 'Fast availability checks for immediate planning.' },
];

const TRUST_ITEMS = [
  { icon: Monitor, title: 'Real-time Monitoring', desc: 'Administrators can track venue status live.' },
  { icon: Coffee, title: 'Shared Commons', desc: 'Managed booking for communal student areas.' },
  { icon: Mic2, title: 'High-Fidelity Studios', desc: 'Specialized hardware access management.' },
];

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=900',
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&q=80&w=900',
  'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&q=80&w=900',
];

const LoginDialog = lazy(() => import('@/components/auth/LoginDialog').then((module) => ({ default: module.LoginDialog })));
const BookingWizard = lazy(() => import('@/components/booking/BookingWizard').then((module) => ({ default: module.BookingWizard })));

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white/5 backdrop-blur-md border border-white/10 rounded-[2rem] overflow-hidden transition-all duration-500 hover:border-white/20 hover:bg-white/10 ${className}`}>
      {children}
    </div>
  );
}

function VenueDirectoryCard({ venue, onBook }: { venue: Venue; onBook: (venue: Venue) => void }) {
  const isAvailable = venue.isAvailable !== false;

  return (
    <div className="group relative bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 overflow-hidden hover:shadow-2xl transition-all duration-500 hover:-translate-y-1">
      <div className="relative aspect-[4/3] overflow-hidden">
        <SafeImage
          src={venue.imageUrl || FALLBACK_IMAGES[0]}
          fallbackSrc={FALLBACK_IMAGES[0]}
          alt={venue.name}
          className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-110"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute top-4 right-4">
          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md ${isAvailable ? 'bg-emerald-500/80 text-white' : 'bg-red-500/80 text-white'}`}>
            {isAvailable ? 'Available' : 'Closed'}
          </span>
        </div>
        {!isAvailable && (
          <div className="absolute inset-0 bg-zinc-900/60 flex items-center justify-center p-6 text-center">
            <p className="text-white text-sm font-medium">{venue.unavailableReason || 'Closed for maintenance'}</p>
          </div>
        )}
      </div>

      <div className="p-6">
        <div className="flex justify-between items-start mb-2 gap-3">
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white leading-tight">{venue.name}</h3>
            <p className="text-sm text-zinc-500 flex items-center gap-1 mt-1">
              <MapPin size={14} /> {venue.location}
            </p>
          </div>
          <div className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded-xl text-center min-w-[52px]">
            <p className="text-[10px] font-bold text-zinc-500 uppercase">Cap.</p>
            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-200">{venue.capacity}</p>
          </div>
        </div>

        <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 mt-3 leading-relaxed">
          {venue.description}
        </p>

        <button
          disabled={!isAvailable}
          onClick={() => onBook(venue)}
          className={`w-full mt-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
            isAvailable
              ? 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200'
              : 'bg-zinc-100 text-zinc-400 cursor-not-allowed dark:bg-zinc-800'
          }`}
        >
          {isAvailable ? 'Book Now' : 'Unavailable'}
          {isAvailable && <ArrowRight size={16} />}
        </button>
      </div>
    </div>
  );
}

export default function LandingPage() {
  //usePageTheme('light');
  usePageTitle('Home');

  const { user } = useAuth();
  const navigate = useNavigate();
  const { settings } = useAppSettings();

  const [search, setSearch] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('11:00');
  const [appliedFilter, setAppliedFilter] = useState<{ date: string; startTime: string; endTime: string } | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    preloadRoute('/');
    preloadLandingOverlays();
    if (!user) return;
    preloadRoute(user.role === 'ADMIN' ? '/admin' : '/dashboard');
  }, [user]);

  const { data: venues = [], isLoading } = useQuery({
    queryKey: ['venues'],
    queryFn: () => api<Venue[]>('/api/venues'),
    staleTime: 0,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 15000
  });

  const { data: availability } = useQuery({
    queryKey: ['venues-availability', appliedFilter?.date, appliedFilter?.startTime, appliedFilter?.endTime],
    queryFn: () => api<AvailabilityResult>(
      `/api/venues/availability?date=${encodeURIComponent(appliedFilter!.date)}&startTime=${encodeURIComponent(appliedFilter!.startTime)}&endTime=${encodeURIComponent(appliedFilter!.endTime)}`
    ),
    enabled: venues.length > 0 && !!appliedFilter && appliedFilter.startTime < appliedFilter.endTime,
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 10000
  });

  const availableSet = useMemo(() => new Set(availability?.availableVenueIds ?? []), [availability?.availableVenueIds]);

  const filteredVenues = useMemo(() => {
    const q = deferredSearch.toLowerCase();
    return venues.filter((v) =>
      v.name.toLowerCase().includes(q) ||
      v.location.toLowerCase().includes(q) ||
      v.description.toLowerCase().includes(q)
    );
  }, [deferredSearch, venues]);

  const displayedVenues = useMemo(() => {
    if (!appliedFilter) return filteredVenues;
    return filteredVenues.filter((v) => {
      if (v.isAvailable === false) return false;
      return availableSet.size === 0 || availableSet.has(v.id);
    });
  }, [appliedFilter, availableSet, filteredVenues]);

  const activeVenueCount = useMemo(() => venues.filter((v) => v.isAvailable !== false).length, [venues]);

  const totalCapacity = useMemo(() => venues.reduce((sum, v) => sum + v.capacity, 0), [venues]);

  const heroImages = venues.map((v) => v.imageUrl).filter((url): url is string => Boolean(url));
  const heroGallery = [...heroImages, ...FALLBACK_IMAGES].slice(0, 3);

  const appDisplayName = settings.appName?.trim() || 'KICT Venue';
  const appLabel = settings.appLabel?.trim() || 'KICT Venue Booking System';

  const handleBook = (venue: Venue) => {
    if (!user) {
      setShowLoginDialog(true);
      return;
    }
    setSelectedVenue(venue);
  };

  const handlePrimaryNavigation = () => {
    if (!user) {
      setShowLoginDialog(true);
      return;
    }

    const target = user.role === 'ADMIN' ? '/admin' : '/dashboard';
    preloadRoute(target);
    startTransition(() => {
      navigate(target);
    });
  };

  const handleMyBookingsClick = () => {
    if (user) {
      navigate('/bookings');
      return;
    }
    setShowLoginDialog(true);
  };

  return (
    <div className="min-h-screen bg-[#f6fbf8] text-zinc-900 selection:bg-emerald-500/20">
      <nav className={`fixed top-0 w-full z-[100] transition-all duration-500 ${scrolled ? 'py-3 sm:py-4 max-[375px]:py-2.5' : 'py-4 sm:py-6 max-[375px]:py-3'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className={`flex items-center justify-between rounded-2xl sm:rounded-full px-3 sm:px-6 max-[375px]:px-2.5 transition-all duration-500 border border-emerald-100 ${scrolled ? 'bg-white/90 backdrop-blur-xl h-14 sm:h-16 max-[375px]:h-12 shadow-[0_20px_60px_-35px_rgba(16,185,129,0.35)] border-emerald-200/80' : 'h-12 sm:h-12 bg-white/70 backdrop-blur-md'}`}>
            <div className="flex items-center gap-3 max-[375px]:gap-2">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                {settings.appIconUrl ? (
                  <SafeImage src={settings.appIconUrl} fallbackSrc={FALLBACK_IMAGES[0]} alt={settings.appName} className="h-full w-full object-cover rounded-lg" />
                ) : (
                  <Building2 size={18} className="text-white" />
                )}
              </div>
              <div className="min-w-0">
                <span className="block truncate font-bold tracking-tight text-base sm:text-lg max-[375px]:text-sm">{appDisplayName}</span>
                <span className="hidden sm:block truncate text-[10px] uppercase tracking-[0.22em] text-zinc-500">{appLabel}</span>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-500">
              <a href="#directory" className="hover:text-emerald-700 transition-colors">Directory</a>
              <button type="button" onClick={handleMyBookingsClick} className="hover:text-emerald-700 transition-colors">My Bookings</button>
              <a href="#support" className="hover:text-emerald-700 transition-colors">Support</a>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 max-[375px]:gap-1.5">
              <ThemeToggle />
              {!user ? (
                <button
                  onMouseEnter={preloadLandingOverlays}
                  onFocus={preloadLandingOverlays}
                  onPointerDown={preloadLandingOverlays}
                  onClick={() => setShowLoginDialog(true)}
                  className="hidden sm:inline-flex text-sm font-semibold hover:text-emerald-700 transition-colors"
                >
                  Sign In
                </button>
              ) : null}
              <button
                onMouseEnter={() => preloadRoute(user?.role === 'ADMIN' ? '/admin' : '/dashboard')}
                onFocus={() => preloadRoute(user?.role === 'ADMIN' ? '/admin' : '/dashboard')}
                onPointerDown={() => preloadRoute(user?.role === 'ADMIN' ? '/admin' : '/dashboard')}
                onClick={handlePrimaryNavigation}
                className="bg-emerald-600 text-white px-3 sm:px-5 max-[375px]:px-2.5 py-2 max-[375px]:py-1.5 rounded-full text-xs sm:text-sm font-bold hover:bg-emerald-500 transition-colors"
              >
                {user?.role === 'ADMIN' ? 'Admin' : user ? 'Dashboard' : 'Book Now'}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <section className="relative pt-24 sm:pt-32 pb-14 sm:pb-20 max-[375px]:pt-20 max-[375px]:pb-12 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_38%),radial-gradient(circle_at_top_right,rgba(34,197,94,0.12),transparent_30%),linear-gradient(180deg,#f8fcfa_0%,#eef8f2_100%)]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-emerald-500/8 blur-[120px] rounded-full" />
        <div className="absolute -top-20 -right-20 w-[400px] h-[400px] bg-cyan-400/10 blur-[100px] rounded-full" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-[1.2fr_0.8fr] gap-10 sm:gap-12 items-center">
          <div className="space-y-6 sm:space-y-8 max-[375px]:space-y-5">

            <h1 className="text-4xl sm:text-6xl md:text-8xl max-[375px]:text-[2.65rem] font-bold tracking-tighter leading-[0.92] sm:leading-[0.9] text-zinc-900">
              Reserve the right <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-cyan-600">KICT venue with clarity.</span>
            </h1>

            <p className="text-base sm:text-lg md:text-xl max-[375px]:text-[15px] text-zinc-600 max-w-xl leading-relaxed max-[375px]:leading-7">
              Browse lecture halls, meeting rooms, labs, and shared spaces across the Kulliyyah of ICT, then book the venue that fits your session, event, or class schedule.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 max-[375px]:gap-3">
              <div className="flex-1 bg-white/80 backdrop-blur-md border border-emerald-100 p-2 max-[375px]:p-1.5 rounded-2xl flex items-center gap-2 group focus-within:border-emerald-500/50 transition-all shadow-[0_18px_40px_-30px_rgba(15,23,42,0.4)]">
                <Search className="ml-3 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                <input
                  type="text"
                  placeholder="Find a lab, hall, or room..."
                  className="bg-transparent border-none outline-none text-zinc-900 w-full py-3 max-[375px]:py-2.5 pr-4 placeholder:text-zinc-400 text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 max-[375px]:px-6 py-3 max-[375px]:py-2.5 rounded-2xl transition-all shadow-lg shadow-emerald-500/20">
                Search
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 pt-2 sm:pt-4">
              {SIGNALS.map((s) => (
                <div key={s.title} className="space-y-1.5 sm:space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-emerald-600 border border-emerald-100 shadow-sm">
                    <s.icon size={20} />
                  </div>
                  <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">{s.title}</h4>
                  <p className="text-[11px] text-zinc-500 leading-tight">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="hidden lg:block relative">
            <div className="relative z-10 grid grid-cols-2 gap-4">
              <div className="space-y-4 pt-12">
                <GlassCard className="aspect-square">
                  <SafeImage src={heroGallery[0]} fallbackSrc={FALLBACK_IMAGES[0]} alt="KICT venue" className="w-full h-full object-cover opacity-60" loading="eager" decoding="async" fetchPriority="high" />
                </GlassCard>
                <GlassCard className="h-40 bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-end p-6">
                  <div className="text-zinc-900">
                    <p className="text-4xl font-black">24/7</p>
                    <p className="text-sm font-bold uppercase">Access Control</p>
                  </div>
                </GlassCard>
              </div>
              <div className="space-y-4">
                <GlassCard className="h-64 flex items-center justify-center p-8 text-center bg-white/70">
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full mx-auto flex items-center justify-center">
                      <Users className="text-emerald-600" size={32} />
                    </div>
                    <p className="text-zinc-600 text-sm">{activeVenueCount}+ active rooms right now</p>
                  </div>
                </GlassCard>
                <GlassCard className="aspect-[4/5]">
                  <SafeImage src={heroGallery[1]} fallbackSrc={FALLBACK_IMAGES[1]} alt="KICT space" className="w-full h-full object-cover opacity-60" loading="lazy" decoding="async" />
                </GlassCard>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="directory" className="bg-white py-16 sm:py-24 max-[375px]:py-14 rounded-t-[2.5rem] sm:rounded-t-[4rem] text-zinc-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10 sm:mb-16">
            <div className="space-y-4 max-[375px]:space-y-3">
              <div className="flex items-center gap-2 text-emerald-600 font-bold uppercase tracking-[0.2em] text-xs">
                <CheckCircle2 size={16} /> Venue Directory
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl max-[375px]:text-[2rem] font-bold tracking-tight">Curated Spaces for Excellence.</h2>
            </div>

            <div className="grid grid-cols-2 w-full md:w-auto gap-3">
              <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col min-w-0 shadow-sm">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Available Now</span>
                <span className="text-2xl font-black text-emerald-500">{availability?.availableVenueIds.length ?? activeVenueCount}</span>
              </div>
              <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col min-w-0 shadow-sm">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Total Capacity</span>
                <span className="text-2xl font-black">{totalCapacity}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 p-3 max-[375px]:p-2.5 rounded-3xl mb-8 sm:mb-12 shadow-xl shadow-zinc-200/50">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-zinc-900 dark:group-focus-within:text-white transition-colors" size={18} />
                <input
                  type="text"
                  placeholder="Search by name..."
                  className="w-full bg-zinc-50 py-4 max-[375px]:py-3.5 pl-12 pr-4 rounded-2xl outline-none focus:ring-2 ring-emerald-500/20 transition-all text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3 max-[375px]:gap-2 bg-zinc-50 px-4 max-[375px]:px-3 py-3 rounded-2xl">
                <Calendar size={18} className="text-zinc-400" />
                <div className="flex flex-col min-w-0">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase leading-none">Date</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent outline-none text-sm font-semibold min-w-0" />
                </div>
              </div>
              <div className="flex items-center gap-3 max-[375px]:gap-2 bg-zinc-50 px-4 max-[375px]:px-3 py-3 rounded-2xl">
                <Clock size={18} className="text-zinc-400" />
                <div className="flex flex-col flex-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase leading-none">Window</label>
                  <div className="flex items-center gap-1 sm:gap-2">
                    <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="bg-transparent outline-none text-sm max-[375px]:text-[13px] font-semibold w-full min-w-0" />
                    <span className="text-zinc-400 text-xs">to</span>
                    <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="bg-transparent outline-none text-sm max-[375px]:text-[13px] font-semibold w-full min-w-0" />
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAppliedFilter({ date, startTime, endTime })}
                className="bg-zinc-900 text-white font-bold h-12 max-[375px]:h-11 rounded-2xl hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                <Filter size={18} /> Apply Filters
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-8">
            {isLoading ? (
              Array.from({ length: 8 }, (_, i) => (
                <Card key={i} className="overflow-hidden rounded-[1.75rem] border-0 shadow-sm">
                  <div className="aspect-[4/3] w-full bg-zinc-200 animate-pulse" />
                  <div className="space-y-3 p-5">
                    <div className="h-6 w-3/4 rounded bg-zinc-200 animate-pulse" />
                    <div className="h-4 w-1/2 rounded bg-zinc-200 animate-pulse" />
                    <div className="h-4 w-full rounded bg-zinc-200 animate-pulse" />
                  </div>
                </Card>
              ))
            ) : displayedVenues.length > 0 ? (
              displayedVenues.map((venue) => (
                <VenueDirectoryCard key={venue.id} venue={venue} onBook={handleBook} />
              ))
            ) : (
              <div className="col-span-full py-14 sm:py-20 text-center space-y-4">
                <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-400">
                  <Search size={32} />
                </div>
                <h3 className="text-xl font-bold">No spaces found</h3>
                <p className="text-zinc-500 max-w-sm mx-auto">Try adjusting your search terms or filters to find what you are looking for.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24 max-[375px]:py-14 bg-[#f3faf6]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-12 sm:gap-20 items-center">
            <div className="space-y-6 sm:space-y-8">
              <h2 className="text-3xl sm:text-4xl max-[375px]:text-[2rem] font-bold tracking-tight">The Trust Layer for University Operations.</h2>
              <p className="text-base sm:text-lg max-[375px]:text-[15px] text-zinc-500 leading-relaxed">
                KICT Venue Command Center is not just a booking tool. It is a governance platform that respects academic hierarchies and maintenance schedules.
              </p>

              <div className="space-y-6">
                {TRUST_ITEMS.map((item) => (
                  <div key={item.title} className="flex gap-4 group">
                    <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-zinc-400 group-hover:text-emerald-500 transition-colors shadow-sm">
                      <item.icon size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-base sm:text-lg mb-1">{item.title}</h4>
                      <p className="text-zinc-500 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 bg-emerald-500/10 blur-2xl rounded-[3rem]" />
              <div className="relative aspect-[4/3] rounded-[2rem] sm:rounded-[3rem] overflow-hidden border border-zinc-200">
                <SafeImage src={heroGallery[2]} fallbackSrc={FALLBACK_IMAGES[2]} alt="KICT environment" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/80 to-transparent flex items-end p-5 sm:p-12">
                  <div className="flex items-center gap-6">
                    <div className="text-white">
                      <p className="text-2xl sm:text-3xl font-black">{venues.length}+</p>
                      <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Venues Available</p>
                    </div>
                    <div className="h-10 w-px bg-white/20" />
                    <div className="text-white">
                      <p className="text-2xl sm:text-3xl font-black">{activeVenueCount}+</p>
                      <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Active Rooms</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer id="support" className="py-14 sm:py-20 border-t border-zinc-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-4 gap-10 sm:gap-12">
          <div className="col-span-1 md:col-span-2 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                {settings.appIconUrl ? (
                  <SafeImage src={settings.appIconUrl} fallbackSrc={FALLBACK_IMAGES[0]} alt={appDisplayName} className="h-full w-full object-cover rounded-lg" />
                ) : (
                  <Building2 size={18} className="text-white" />
                )}
              </div>
              <span className="font-bold tracking-tight text-lg">{appDisplayName}</span>
            </div>
            <p className="text-zinc-500 max-w-xs text-sm leading-relaxed">
              International Islamic University Malaysia. <br />
              Kulliyyah of Information and Communication Technology.
            </p>
          </div>
          <div className="space-y-6">
            <h4 className="font-bold text-sm uppercase tracking-widest">Platform</h4>
            <ul className="space-y-4 text-sm text-zinc-500">
              <li><a href="#directory" className="hover:text-emerald-500 transition-colors">Directory</a></li>
              <li><a href="#" className="hover:text-emerald-500 transition-colors">How it works</a></li>
              <li><a href="#" className="hover:text-emerald-500 transition-colors">Auth Login</a></li>
            </ul>
          </div>
          <div className="space-y-6">
            <h4 className="font-bold text-sm uppercase tracking-widest">Connect</h4>
            <ul className="space-y-4 text-sm text-zinc-500">
              <li><a href="#" className="hover:text-emerald-500 transition-colors">Support Center</a></li>
              <li><a href="#" className="hover:text-emerald-500 transition-colors">KICT Office</a></li>
              <li><a href="#" className="hover:text-emerald-500 transition-colors">Emergency</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-12 sm:mt-20 pt-8 border-t border-zinc-100 flex flex-col md:flex-row justify-between gap-4 text-xs font-bold uppercase tracking-widest text-zinc-500">
          <p>© {new Date().getFullYear()} {appDisplayName}. All rights reserved.</p>
          <div className="flex gap-5 sm:gap-8">
            <a href="#" className="hover:text-zinc-900 transition-colors">Privacy</a>
            <a href="#" className="hover:text-zinc-900 transition-colors">Terms</a>
          </div>
        </div>
      </footer>

      {user ? (
        <Suspense fallback={null}>
          <BookingWizard
            venue={selectedVenue}
            isOpen={!!selectedVenue}
            onClose={() => setSelectedVenue(null)}
            onSuccess={() => {
              setSelectedVenue(null);
              const target = user.role === 'ADMIN' ? '/admin' : '/dashboard';
              preloadRoute(target);
              navigate(target);
            }}
          />
        </Suspense>
      ) : null}

      <Suspense fallback={null}>
        <LoginDialog isOpen={showLoginDialog} onClose={() => setShowLoginDialog(false)} />
      </Suspense>
    </div>
  );
}
