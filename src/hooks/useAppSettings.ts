import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '@/lib/api-client';
import type { AppSettings } from '@shared/types';

const DEFAULT_SETTINGS: Required<Pick<AppSettings, 'appName' | 'appLabel'>> & AppSettings = {
  appName: 'BookingTrack',
  appLabel: 'Professional Venue Management',
  heroImageUrl: '/images/hero-painting.jpg',
  appIconUrl: ''
};

const SETTINGS_CACHE_KEY = 'bookingtrack_app_settings_cache';

function readCachedSettings(): AppSettings | undefined {
  if (typeof window === 'undefined') return undefined;

  try {
    const raw = window.localStorage.getItem(SETTINGS_CACHE_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw) as AppSettings;
  } catch {
    return undefined;
  }
}

export function useAppSettings() {
  const query = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<AppSettings>('/api/settings'),
    initialData: readCachedSettings,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnMount: false
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !query.data) return;

    try {
      window.localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(query.data));
    } catch {
      // Ignore cache write failures and keep using fetched settings.
    }
  }, [query.data]);

  return {
    ...query,
    settings: {
      ...DEFAULT_SETTINGS,
      ...(query.data ?? {})
    }
  };
}
