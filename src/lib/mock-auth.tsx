import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserRole } from '@shared/types';
import { api } from './api-client';

export interface AuthContextType {
  user: User | null;
  loginWithEmail: (email: string) => Promise<string>; // Returns debug code if any, or void
  verifyOtp: (email: string, code: string, name?: string) => Promise<User>;
  loginWithGoogle: (email: string, name: string, avatar?: string) => Promise<User>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for token and user on load
    const token = localStorage.getItem('nexus_token');
    const savedUser = localStorage.getItem('nexus_user');
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('nexus_user');
        localStorage.removeItem('nexus_token');
      }
    }
    setIsLoading(false);
  }, []);

  const loginWithEmail = async (email: string): Promise<string> => {
    const res = await api<{ message: string; debugCode?: string }>('/api/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    // For demo purposes, we might return the debug code
    return res.debugCode || '';
  };

  const verifyOtp = async (email: string, code: string, name?: string): Promise<User> => {
    const res = await api<{ token: string; user: User }>('/api/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code, name })
    });

    localStorage.setItem('nexus_token', res.token);
    localStorage.setItem('nexus_user', JSON.stringify(res.user));
    setUser(res.user);
    return res.user;
  };

  const loginWithGoogle = async (email: string, name: string, avatar?: string): Promise<User> => {
    const res = await api<{ token: string; user: User }>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ email, name, avatar })
    });

    localStorage.setItem('nexus_token', res.token);
    localStorage.setItem('nexus_user', JSON.stringify(res.user));
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('nexus_user');
    localStorage.removeItem('nexus_token');
  };

  return (
    <AuthContext.Provider value={{ user, loginWithEmail, verifyOtp, loginWithGoogle, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };