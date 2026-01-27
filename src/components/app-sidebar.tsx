import React from "react";
import { 
  LayoutDashboard, 
  Building2, 
  ClipboardList, 
  ShieldCheck, 
  Settings, 
  History,
  LogOut,
  User as UserIcon
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
export function AppSidebar(): JSX.Element {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isAdmin = user?.role === 'ADMIN';
  const navItems = isAdmin ? [
    { title: "Admin Console", icon: ShieldCheck, href: "/admin" },
    { title: "Venue Management", icon: Building2, href: "/admin/venues" },
    { title: "Global History", icon: History, href: "/admin/history" },
  ] : [
    { title: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    { title: "Venue Explorer", icon: Building2, href: "/dashboard" },
    { title: "My Bookings", icon: ClipboardList, href: "/bookings" },
  ];
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 shadow-md">
            <span className="text-sm font-bold text-white">NR</span>
          </div>
          <div className="flex flex-col truncate group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold leading-none">Nexus Reserve</span>
            <span className="text-xs text-muted-foreground mt-1">Enterprise Booking</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {navItems.map((item, index) => (
              <SidebarMenuItem key={`nav-${index}`}>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === item.href}
                  tooltip={item.title}
                >
                  <Link to={item.href}>
                    <item.icon className="size-4" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup className="mt-auto">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Settings">
                <Settings className="size-4" />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-3 px-2 py-4 group-data-[collapsible=icon]:justify-center">
              <div className="h-8 w-8 shrink-0 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
                ) : (
                  <UserIcon className="size-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-col truncate group-data-[collapsible=icon]:hidden">
                <span className="text-xs font-medium truncate">{user?.name}</span>
                <span className="text-[10px] text-muted-foreground truncate">{user?.role}</span>
              </div>
              <button 
                onClick={logout}
                className="ml-auto group-data-[collapsible=icon]:hidden text-muted-foreground hover:text-destructive transition-colors"
                aria-label="Logout"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}