import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Timer, CheckCircle2, Building, TrendingUp, Calendar, Users } from "lucide-react";
import type { Booking, Venue } from "@shared/types";

interface AdminStatsProps {
  bookings: Booking[];
  venues?: Venue[];
}

export function AdminStats({ bookings, venues }: AdminStatsProps) {
  const pending = bookings.filter(b => b.status === 'PENDING').length;
  const approvedToday = bookings.filter(b => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return b.status === 'APPROVED' && new Date(b.createdAt) >= today;
  }).length;
  const totalBookings = bookings.length;
  const totalVenues = venues?.length ?? 0;

  const stats = [
    {
      label: "Pending Requests",
      value: pending,
      icon: Timer,
      trend: pending > 0 ? `${pending} awaiting` : 'All clear',
      gradient: 'from-amber-500 to-orange-600',
      bgLight: 'bg-amber-50 dark:bg-amber-950/30',
      iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600',
    },
    {
      label: "Approved Today",
      value: approvedToday,
      icon: CheckCircle2,
      trend: approvedToday > 0 ? '+' + approvedToday + ' today' : 'None yet',
      gradient: 'from-emerald-500 to-teal-600',
      bgLight: 'bg-emerald-50 dark:bg-emerald-950/30',
      iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-600',
    },
    {
      label: "Total Bookings",
      value: totalBookings,
      icon: Calendar,
      trend: 'All time',
      gradient: 'from-blue-500 to-indigo-600',
      bgLight: 'bg-blue-50 dark:bg-blue-950/30',
      iconBg: 'bg-gradient-to-br from-blue-500 to-indigo-600',
    },
    {
      label: "Active Venues",
      value: totalVenues,
      icon: Building,
      trend: 'Available',
      gradient: 'from-violet-500 to-purple-600',
      bgLight: 'bg-violet-50 dark:bg-violet-950/30',
      iconBg: 'bg-gradient-to-br from-violet-500 to-purple-600',
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <Card
          key={i}
          className="stat-card border-0 shadow-sm hover:shadow-lg bg-card overflow-hidden"
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </p>
                <div className="space-y-1">
                  <p className="text-4xl font-bold tracking-tight">
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {stat.trend}
                  </p>
                </div>
              </div>
              <div className={`${stat.iconBg} p-3.5 rounded-2xl shadow-lg`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>

            {/* Progress Indicator for Pending */}
            {stat.label === "Pending Requests" && pending > 0 && (
              <div className="mt-4 pt-4 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-orange-600 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min((pending / Math.max(totalBookings, 1)) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {Math.round((pending / Math.max(totalBookings, 1)) * 100)}%
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}