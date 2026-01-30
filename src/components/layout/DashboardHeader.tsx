import React from 'react';
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

export function DashboardHeader() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'Dashboard';
    if (path === '/bookings') return 'My Bookings';
    if (path === '/admin') return 'Admin Console';
    if (path.includes('/admin/venues')) return 'Venue Management';
    if (path.includes('/admin/history')) return 'History';
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
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground"
        >
          <Bell className="h-5 w-5" />
          {/* Notification dot */}
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
        </Button>

        <Separator orientation="vertical" className="h-5 mx-1" />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-9 gap-2 rounded-lg px-2 hover:bg-muted"
            >
              <Avatar className="h-7 w-7 border border-border">
                <AvatarImage src={user?.avatar} alt={user?.name} />
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
                  <AvatarImage src={user?.avatar} alt={user?.name} />
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