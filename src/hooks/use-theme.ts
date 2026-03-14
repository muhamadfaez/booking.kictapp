import { useState, useEffect } from 'react';

const getStoredTheme = () => localStorage.getItem('theme');

export function applyTheme(theme: 'dark' | 'light') {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
    return;
  }

  document.documentElement.classList.remove('dark');
  localStorage.setItem('theme', 'light');
}

export function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    const savedTheme = getStoredTheme();
    return savedTheme ? savedTheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    applyTheme(isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  return { isDark, toggleTheme };
}
