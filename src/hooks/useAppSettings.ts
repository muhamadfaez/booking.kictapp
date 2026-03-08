import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { AppSettings } from '@shared/types';

const DEFAULT_SETTINGS: Required<Pick<AppSettings, 'appName' | 'appLabel'>> & AppSettings = {
  appName: 'BookingTrack',
  appLabel: 'Professional Venue Management',
  heroImageUrl: '/images/hero-painting.jpg',
  appIconUrl: ''
};

export function useAppSettings() {
  const query = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<AppSettings>('/api/settings')
  });

  return {
    ...query,
    settings: {
      ...DEFAULT_SETTINGS,
      ...(query.data ?? {})
    }
  };
}
