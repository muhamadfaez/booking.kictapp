import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserRole } from '@shared/types';

// Admin emails that have admin access
const ADMIN_EMAILS = ['muhamadfaez@iium.edu.my'];

export interface AuthContextType {
  user: User | null;
  login: (role: UserRole) => void;
  loginWithEmail: (email: string, name?: string) => User;
  loginWithGoogle: (email: string, name: string, avatar?: string) => User;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to determine role based on email
function getRoleForEmail(email: string): UserRole {
  return ADMIN_EMAILS.includes(email.toLowerCase()) ? 'ADMIN' : 'USER';
}

// Generate a unique user ID from email
function generateUserId(email: string): string {
  return `user_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('nexus_user');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {
        localStorage.removeItem('nexus_user');
      }
    }
    setIsLoading(false);
  }, []);

  // Legacy login by role (for backwards compatibility)
  const login = (role: UserRole) => {
    const mockUser: User = role === 'ADMIN'
      ? {
        id: 'admin_muhamadfaez',
        name: 'Muhamad Faez',
        email: 'muhamadfaez@iium.edu.my',
        role: 'ADMIN',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin'
      }
      : {
        id: 'user_guest',
        name: 'Guest User',
        email: 'guest@example.com',
        role: 'USER',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Guest'
      };
    setUser(mockUser);
    localStorage.setItem('nexus_user', JSON.stringify(mockUser));
  };

  // Login with email (for email verification flow)
  const loginWithEmail = (email: string, name?: string): User => {
    const role = getRoleForEmail(email);
    const displayName = name || email.split('@')[0];

    const newUser: User = {
      id: generateUserId(email),
      name: displayName,
      email: email.toLowerCase(),
      role,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`
    };

    setUser(newUser);
    localStorage.setItem('nexus_user', JSON.stringify(newUser));
    return newUser;
  };

  // Login with Google OAuth
  const loginWithGoogle = (email: string, name: string, avatar?: string): User => {
    const role = getRoleForEmail(email);

    const newUser: User = {
      id: generateUserId(email),
      name,
      email: email.toLowerCase(),
      role,
      avatar: avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`
    };

    setUser(newUser);
    localStorage.setItem('nexus_user', JSON.stringify(newUser));
    return newUser;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('nexus_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, loginWithEmail, loginWithGoogle, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };