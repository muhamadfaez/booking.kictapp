import React, { createContext, useState, useEffect } from 'react';
import type { User } from '@shared/types';
import { api } from './api-client';

export interface AuthContextType {
  user: User | null;
  loginWithEmail: (email: string) => Promise<string>;
  verifyOtp: (email: string, code: string, name?: string) => Promise<User>;
  loginWithGoogle: (accessToken: string) => Promise<User>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const FALLBACK_EMAIL_KEY = 'nexus_user_email';

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeUser(rawUser: User | null, token: string | null): User | null {
  if (!rawUser && !token) return null;
  const payload = token ? decodeJwtPayload(token) : null;

  const id = rawUser?.id || (typeof payload?.sub === 'string' ? payload.sub : '');
  const email =
    rawUser?.email ||
    (typeof payload?.email === 'string' ? payload.email : '') ||
    localStorage.getItem(FALLBACK_EMAIL_KEY) ||
    '';
  const role = rawUser?.role || (payload?.role === 'ADMIN' ? 'ADMIN' : 'USER');
  const name = rawUser?.name || (email ? email.split('@')[0] : '');

  if (!id || !email) {
    return rawUser;
  }

  return {
    ...rawUser,
    id,
    email,
    role,
    name
  } as User;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for token and user on load
    const token = localStorage.getItem('nexus_token');
    const savedUser = localStorage.getItem('nexus_user');
    if (token && savedUser) {
      try {
        const normalized = normalizeUser(JSON.parse(savedUser) as User, token);
        if (normalized) {
          localStorage.setItem('nexus_user', JSON.stringify(normalized));
          if (normalized.email) {
            localStorage.setItem(FALLBACK_EMAIL_KEY, normalized.email);
          }
        }
        setUser(normalized);
      } catch {
        localStorage.removeItem('nexus_user');
        localStorage.removeItem('nexus_token');
      }
    }
    setIsLoading(false);
  }, []);

  const loginWithEmail = async (email: string): Promise<string> => {
    localStorage.setItem(FALLBACK_EMAIL_KEY, email.trim().toLowerCase());
    const res = await api<{ message: string; debugCode?: string }>('/api/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    return res.debugCode || '';
  };

  const verifyOtp = async (email: string, code: string, name?: string): Promise<User> => {
    const res = await api<{ token: string; user: User }>('/api/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code, name })
    });

    const normalized = normalizeUser(res.user, res.token);
    localStorage.setItem('nexus_token', res.token);
    localStorage.setItem('nexus_user', JSON.stringify(normalized));
    if (normalized?.email) {
      localStorage.setItem(FALLBACK_EMAIL_KEY, normalized.email);
    }
    setUser(normalized);
    return normalized!;
  };

  const loginWithGoogle = async (accessToken: string): Promise<User> => {
    const res = await api<{ token: string; user: User }>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ accessToken })
    });

    const normalized = normalizeUser(res.user, res.token);
    localStorage.setItem('nexus_token', res.token);
    localStorage.setItem('nexus_user', JSON.stringify(normalized));
    if (normalized?.email) {
      localStorage.setItem(FALLBACK_EMAIL_KEY, normalized.email);
    }
    setUser(normalized);
    return normalized!;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('nexus_user');
    localStorage.removeItem('nexus_token');
    localStorage.removeItem(FALLBACK_EMAIL_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, loginWithEmail, verifyOtp, loginWithGoogle, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };
