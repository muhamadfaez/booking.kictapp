import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { api } from '@/lib/api-client';
import type { User } from '@shared/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

type SignInRecord = {
  userId: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  method: 'OTP' | 'GOOGLE';
  signedInAt: number;
};

type SignInSummary = {
  windowHours: number;
  count: number;
  items: SignInRecord[];
};

export default function AdminUsersPage() {
  const [roleDraft, setRoleDraft] = useState<Record<string, 'USER' | 'ADMIN'>>({});
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const { data: users = [], refetch: refetchUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api<User[]>('/api/admin/users')
  });

  const { data: signIns } = useQuery({
    queryKey: ['admin-signins-24h'],
    queryFn: () => api<SignInSummary>('/api/admin/signins-24h')
  });

  const rows = useMemo(() => users.map((u) => ({
    ...u,
    nextRole: roleDraft[u.id] ?? u.role
  })), [users, roleDraft]);

  const handleSaveRole = async (userId: string) => {
    const nextRole = roleDraft[userId];
    if (!nextRole) return;
    setSavingUserId(userId);
    try {
      await api(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
        method: 'POST',
        body: JSON.stringify({ role: nextRole })
      });
      toast.success('User role updated');
      await refetchUsers();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update role');
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <AppLayout container>
      <div className="space-y-8">
        <header className="relative overflow-hidden rounded-2xl bg-gradient-subtle p-8 border border-border/50">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-primary opacity-5 blur-3xl" />
          <div className="relative space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <Users className="w-5 h-5" />
              <span className="text-sm font-medium uppercase tracking-wider">User Management</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Users</h1>
            <p className="text-muted-foreground max-w-2xl">
              Manage administrator access and monitor recent sign-ins.
            </p>
          </div>
        </header>

        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="px-6 py-5 border-b border-border/50 bg-muted/30">
            <CardTitle className="text-lg font-bold">Admin Role Management</CardTitle>
            <CardDescription className="mt-1">Promote or demote users between USER and ADMIN roles.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-background">
                  <tr>
                    <th className="text-left font-semibold p-3">Name</th>
                    <th className="text-left font-semibold p-3">Email</th>
                    <th className="text-left font-semibold p-3">Current Role</th>
                    <th className="text-left font-semibold p-3">Update Role</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => (
                    <tr key={u.id} className="border-b last:border-b-0">
                      <td className="p-3 font-medium">{u.name || u.id}</td>
                      <td className="p-3 text-muted-foreground">{u.email}</td>
                      <td className="p-3">
                        <Badge variant={u.role === 'ADMIN' ? 'default' : 'outline'}>{u.role}</Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2 max-w-xs">
                          <Select
                            value={u.nextRole}
                            onValueChange={(v) => setRoleDraft((prev) => ({ ...prev, [u.id]: v as 'USER' | 'ADMIN' }))}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="USER">USER</SelectItem>
                              <SelectItem value="ADMIN">ADMIN</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            disabled={savingUserId === u.id || u.nextRole === u.role}
                            onClick={() => handleSaveRole(u.id)}
                          >
                            Save
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="px-6 py-5 border-b border-border/50 bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Signed-In Users (Last 24 Hours)
                </CardTitle>
                <CardDescription className="mt-1">
                  Unique users who authenticated in the rolling 24-hour window.
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-sm font-semibold">
                {signIns?.count ?? 0} users
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {(signIns?.items?.length ?? 0) === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No sign-ins recorded in the last 24 hours.</div>
            ) : (
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background border-b">
                    <tr>
                      <th className="text-left font-semibold p-3">User</th>
                      <th className="text-left font-semibold p-3">Email</th>
                      <th className="text-left font-semibold p-3">Role</th>
                      <th className="text-left font-semibold p-3">Method</th>
                      <th className="text-left font-semibold p-3">Signed In At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signIns?.items.map((item) => (
                      <tr key={item.userId} className="border-b last:border-b-0">
                        <td className="p-3 font-medium">{item.name || item.userId}</td>
                        <td className="p-3 text-muted-foreground">{item.email}</td>
                        <td className="p-3">
                          <Badge variant={item.role === 'ADMIN' ? 'default' : 'outline'}>{item.role}</Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant="secondary">{item.method}</Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {format(new Date(item.signedInAt), 'MMM dd, yyyy HH:mm')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
