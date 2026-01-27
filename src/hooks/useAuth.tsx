import React, { useContext } from 'react';
import type { AuthContextType } from '@/lib/mock-auth';
import { AuthContext } from '@/lib/mock-auth';
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}