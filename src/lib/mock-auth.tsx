import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserRole } from '@shared/types';
import { MOCK_USERS } from '@shared/mock-data';
interface AuthContextType {
  user: User | null;
  login: (role: UserRole) => void;
  logout: () => void;
  isLoading: boolean;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const saved = localStorage.getItem('nexus_user');
    if (saved) {
      setUser(JSON.parse(saved));
    }
    setIsLoading(false);
  }, []);
  const login = (role: UserRole) => {
    const mockUser = MOCK_USERS.find(u => u.role === role) || MOCK_USERS[0];
    setUser(mockUser);
    localStorage.setItem('nexus_user', JSON.stringify(mockUser));
  };
  const logout = () => {
    setUser(null);
    localStorage.removeItem('nexus_user');
  };
  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}