import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Timer, CheckCircle2, Building, PieChart } from "lucide-react";
import type { Booking } from "@shared/types";
interface AdminStatsProps {
  bookings: Booking[];
}
export function AdminStats({ bookings }: AdminStatsProps) {
  const pending = bookings.filter(b => b.status === 'PENDING').length;
  const approved = bookings.filter(b => b.status === 'APPROVED').length;
  const total = bookings.length;
  const stats = [
    {
      label: "Pending Approvals",
      value: pending,
      icon: Timer,
      color: "text-amber-500",
      bg: "bg-amber-500/10"
    },
    {
      label: "Approved Today",
      value: approved,
      icon: CheckCircle2,
      color: "text-green-600",
      bg: "bg-green-600/10"
    },
    {
      label: "Capacity Usage",
      value: total > 0 ? `${Math.round((approved / total) * 100)}%` : "0%",
      icon: PieChart,
      color: "text-teal-600",
      bg: "bg-teal-600/10"
    },
    {
      label: "Total Venues",
      value: "3", // Hardware for now based on mock data
      icon: Building,
      color: "text-blue-600",
      bg: "bg-blue-600/10"
    }
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <Card key={i} className="border-none shadow-sm bg-card hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
            </div>
            <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color}`}>
              <stat.icon className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}