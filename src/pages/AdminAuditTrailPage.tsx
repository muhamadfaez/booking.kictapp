import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow, format } from 'date-fns';
import { Activity, ShieldCheck } from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api-client';
import { usePageTitle } from '@/hooks/use-page-title';
import type { AuditTrailEntry } from '@shared/types';

export default function AdminAuditTrailPage() {
  usePageTitle('Audit Trail');

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['admin-audit-trail'],
    queryFn: () => api<AuditTrailEntry[]>('/api/admin/audit-trail'),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 60 * 1000
  });

  return (
    <AppLayout container>
      <div className="space-y-8">
        <header className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-subtle p-8">
          <div className="absolute right-0 top-0 h-64 w-64 bg-gradient-primary opacity-5 blur-3xl" />
          <div className="relative space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-sm font-medium uppercase tracking-wider">Admin Oversight</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Audit Trail</h1>
            <p className="max-w-2xl text-muted-foreground">
              Review recorded actions across bookings, users, venues, and settings.
            </p>
          </div>
        </header>

        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b border-border/50 bg-muted/30">
            <CardTitle className="flex items-center gap-2 text-lg font-bold">
              <Activity className="h-5 w-5 text-primary" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              {entries.length} logged event{entries.length === 1 ? '' : 's'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      Loading audit entries...
                    </TableCell>
                  </TableRow>
                ) : entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      No audit entries recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="space-y-1">
                        <div className="font-medium">{entry.summary}</div>
                        <Badge variant="outline" className="rounded-full">
                          {entry.action.replaceAll('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{entry.actorEmail}</div>
                        <div className="text-xs text-muted-foreground">{entry.actorRole || 'SYSTEM'}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{entry.targetType}</div>
                        <div className="text-xs text-muted-foreground">{entry.targetId || 'N/A'}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{formatDistanceToNow(entry.createdAt, { addSuffix: true })}</div>
                        <div className="text-xs text-muted-foreground">{format(entry.createdAt, 'dd MMM yyyy, hh:mm a')}</div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
