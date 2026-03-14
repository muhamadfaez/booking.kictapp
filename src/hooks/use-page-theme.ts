import { useEffect } from 'react';
import { applyTheme } from '@/hooks/use-theme';

export function usePageTheme(theme: 'dark' | 'light') {
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
}
