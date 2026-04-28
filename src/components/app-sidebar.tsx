import React from "react";
import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  ShieldCheck,
  Settings,
  History,
  Users,
  Globe,
  Activity,
  LogOut,
  User as UserIcon,
  Sparkles,
  ChevronRight,
  CalendarDays,
  BriefcaseBusiness
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAppSettings } from "@/hooks/useAppSettings";
import { getUserAvatarUrl } from "@/lib/avatar";
import { SafeImage } from "@/components/ui/safe-image";
import { preloadRoute } from "@/lib/route-preload";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { ManagerAssignment, Venue } from "@shared/types";

const FALLBACK_APP_ICON = 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=300';
type ManagerProfile = {
  isManager: boolean;
  assignments: ManagerAssignment[];
  venues: Venue[];
  venueIds: string[];
};

export function AppSidebar(): JSX.Element {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isAdmin = user?.role === 'ADMIN';
  const { settings } = useAppSettings();
  const userAvatarUrl = getUserAvatarUrl(user);
  const { data: managerProfile } = useQuery({
    queryKey: ['manager-profile', user?.id],
    queryFn: () => api<ManagerProfile>('/api/manager/profile'),
    enabled: !!user,
    staleTime: 60 * 1000
  });

  React.useEffect(() => {
    preloadRoute('/');
    if (!user) return;
    preloadRoute(user.role === 'ADMIN' ? '/admin' : '/dashboard');
  }, [user]);

  const userNavItems = [
    { title: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    { title: "My Bookings", icon: ClipboardList, href: "/bookings" },
    { title: "Venue", icon: Building2, href: "/venues" },
    { title: "Live Site", icon: Globe, href: "/" },
  ];
  const managerNavItem = { title: "Venue Manager", icon: BriefcaseBusiness, href: "/manager" };

  const navItems = isAdmin ? [
    { title: "Admin Dashboard", icon: ShieldCheck, href: "/admin" },
    { title: "User Management", icon: Users, href: "/admin/users" },
    { title: "Venue Management", icon: Building2, href: "/admin/venues" },
    { title: "Global Schedule", icon: CalendarDays, href: "/schedule" },
    { title: "Booking History", icon: History, href: "/admin/history" },
    { title: "Audit Trail", icon: Activity, href: "/admin/audit" },
    { title: "Live Site", icon: Globe, href: "/" },
  ] : userNavItems;

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4 group-data-[collapsible=icon]:p-2 transition-all">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 transition-all">
            {settings.appIconUrl ? (
              <SafeImage src={settings.appIconUrl} fallbackSrc={FALLBACK_APP_ICON} alt={settings.appName} className="h-full w-full object-cover rounded-xl" />
            ) : (
              <Sparkles className="h-5 w-5 text-white" />
            )}
          </div>
          <div className="flex flex-col truncate group-data-[collapsible=icon]:hidden">
            <span className="text-base font-bold leading-none tracking-tight">{settings.appName}</span>
            <span className="text-xs text-muted-foreground mt-1">{settings.appLabel}</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 group-data-[collapsible=icon]:!px-0">
        <SidebarGroup>
          <SidebarMenu className="gap-1">
            {navItems.map((item, index) => {
              const isActive = location.pathname === item.href;

              return (
                <SidebarMenuItem key={`nav-${index}`}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    tooltip={item.title}
                    className={`
                      relative h-11 rounded-xl transition-all duration-200
                      ${isActive
                        ? 'bg-primary/10 text-primary font-semibold shadow-sm'
                        : 'hover:bg-muted/80'
                      }
                    `}
                  >
                    <Link
                      to={item.href}
                      className="flex items-center gap-3"
                      onMouseEnter={() => preloadRoute(item.href)}
                      onFocus={() => preloadRoute(item.href)}
                      onPointerDown={() => preloadRoute(item.href)}
                    >
                      <item.icon className={`size-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                      {isActive && (
                        <ChevronRight className="ml-auto size-4 text-primary group-data-[collapsible=icon]:hidden" />
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        {!isAdmin && managerProfile?.isManager && (
          <>
            <SidebarSeparator className="my-4" />
            <SidebarGroup>
              <SidebarMenu className="gap-1">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === managerNavItem.href}
                    tooltip={managerNavItem.title}
                    className={`
                      relative h-11 rounded-xl transition-all duration-200
                      ${location.pathname === managerNavItem.href
                        ? 'bg-primary/10 text-primary font-semibold shadow-sm'
                        : 'hover:bg-muted/80'
                      }
                    `}
                  >
                    <Link
                      to={managerNavItem.href}
                      className="flex items-center gap-3"
                      onMouseEnter={() => preloadRoute(managerNavItem.href)}
                      onFocus={() => preloadRoute(managerNavItem.href)}
                      onPointerDown={() => preloadRoute(managerNavItem.href)}
                    >
                      <managerNavItem.icon className={`size-5 ${location.pathname === managerNavItem.href ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="group-data-[collapsible=icon]:hidden">{managerNavItem.title}</span>
                      {location.pathname === managerNavItem.href && (
                        <ChevronRight className="ml-auto size-4 text-primary group-data-[collapsible=icon]:hidden" />
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </>
        )}

        {isAdmin && (
          <>
            <SidebarSeparator className="my-4" />

            <SidebarGroup>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === '/admin/settings'}
                    tooltip="Settings"
                    className="h-11 rounded-xl hover:bg-muted/80 transition-all duration-200"
                  >
                    <Link to="/admin/settings" className="flex items-center gap-3">
                      <Settings className="size-5 text-muted-foreground" />
                      <span className="group-data-[collapsible=icon]:hidden">Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 group-data-[collapsible=icon]:p-2">
        <div className="rounded-xl bg-muted/50 p-3 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:bg-transparent transition-all duration-200">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-secondary to-secondary/80 flex items-center justify-center overflow-hidden border-2 border-background shadow-sm group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 transition-all">
              {user ? (
                <SafeImage src={userAvatarUrl} fallbackSrc={FALLBACK_APP_ICON} alt={user.name} className="h-full w-full object-cover" />
              ) : (
                <UserIcon className="size-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col truncate group-data-[collapsible=icon]:hidden flex-1">
              <span className="text-sm font-semibold truncate">{user?.name}</span>
              <span className="text-xs text-muted-foreground truncate">{user?.role === 'ADMIN' ? 'Administrator' : 'Standard User'}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="ml-auto group-data-[collapsible=icon]:hidden h-9 w-9 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
              aria-label="Logout"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
