import { useEffect } from 'react';
import { useAppSettings } from '@/hooks/useAppSettings';

export function usePageTitle(title: string, includeAppName = true) {
  const { settings } = useAppSettings();

  useEffect(() => {
    const appName = settings.appName?.trim();
    const baseTitle = title.trim() || appName || 'BookingTrack';
    const fullTitle = includeAppName && appName && baseTitle !== appName
      ? `${baseTitle} | ${appName}`
      : baseTitle;

    document.title = fullTitle;
  }, [title, includeAppName, settings.appName]);
}
