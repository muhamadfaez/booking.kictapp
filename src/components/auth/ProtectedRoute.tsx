import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@shared/types';
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
}
export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/" replace />;
  }
  if (requiredRole && user.role !== requiredRole) {
    // If an admin tries to access a user page or vice versa incorrectly, 
    // but usually admins can see user pages, so we specifically check if role is sufficient.
    // For this app: ADMIN can access ADMIN, USER can access USER.
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}