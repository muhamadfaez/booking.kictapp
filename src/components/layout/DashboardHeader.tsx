import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { useAuth } from '@/hooks/useAuth';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, User as UserIcon, Bell, Settings, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from 'react-router-dom';
import { api } from '@/lib/api-client';
import { getUserAvatarUrl } from '@/lib/avatar';
import type { Notification } from '@shared/types';
import { formatDistanceToNow } from 'date-fns';

export function DashboardHeader() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const userAvatarUrl = getUserAvatarUrl(user);
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<Notification[]>('/api/notifications'),
    enabled: !!user
  });
  const unreadCount = notifications.filter((item) => !item.readAt).length;

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'Dashboard';
    if (path === '/venues') return 'Venue';
    if (path === '/bookings') return 'My Bookings';
    if (path === '/admin') return 'Admin Dashboard';
    if (path.includes('/admin/users')) return 'Users';
    if (path.includes('/admin/venues')) return 'Venue Management';
    if (path.includes('/admin/history')) return 'Booking History';
    if (path.includes('/admin/audit')) return 'Audit Trail';
    if (path.includes('/admin/settings')) return 'Settings';
    return 'Dashboard';
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border/50 bg-background/80 px-4 backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="-ml-1 hover:bg-muted rounded-lg transition-colors" />
        <Separator orientation="vertical" className="h-5" />
        <nav className="flex items-center space-x-1.5 text-sm">
          <span className="text-foreground font-semibold">{getPageTitle()}</span>
        </nav>
      </div>

      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 ? (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[360px] p-2" align="end" sideOffset={8}>
            <DropdownMenuLabel className="px-3 py-2">Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <div className="px-3 py-6 text-sm text-muted-foreground">No notifications yet.</div>
            ) : (
              notifications.slice(0, 8).map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className="flex h-auto cursor-pointer items-start gap-3 rounded-lg px-3 py-3"
                  onClick={async () => {
                    if (!notification.readAt) {
                      await api(`/api/notifications/${notification.id}/read`, { method: 'POST' });
                      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
                    }
                  }}
                >
                  <div className={`mt-1 h-2.5 w-2.5 rounded-full ${notification.readAt ? 'bg-muted-foreground/30' : 'bg-primary'}`} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium">{notification.title}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{notification.message}</p>
                  </div>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="h-5 mx-1" />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-9 gap-2 rounded-lg px-2 hover:bg-muted"
            >
              <Avatar className="h-7 w-7 border border-border">
                <AvatarImage src={userAvatarUrl} alt={user?.name} />
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-xs font-bold">
                  {user?.name?.[0]?.toUpperCase() || ''}
                </AvatarFallback>
              </Avatar>
              {/* <span className="text-sm font-medium hidden sm:block">{user?.name?.split(' ')[0]}</span> */}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 p-2" align="end" sideOffset={8}>
            <DropdownMenuLabel className="font-normal p-3 bg-muted/50 rounded-lg mb-2">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border-2 border-background">
                  <AvatarImage src={userAvatarUrl} alt={user?.name} />
                  <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-bold">
                    {user?.name?.[0]?.toUpperCase() || ''}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <p className="text-sm font-semibold">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuItem className="h-10 rounded-lg cursor-pointer">
              <UserIcon className="mr-3 h-4 w-4 text-muted-foreground" />
              <span>Profile Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="h-10 rounded-lg cursor-pointer">
              <Settings className="mr-3 h-4 w-4 text-muted-foreground" />
              <span>Preferences</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-2" />
            <DropdownMenuItem
              onClick={logout}
              className="h-10 rounded-lg cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <LogOut className="mr-3 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
