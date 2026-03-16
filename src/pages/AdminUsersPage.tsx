import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { api } from '@/lib/api-client';
import type { User } from '@shared/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Users, Activity, UserPlus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/use-page-title';

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
  usePageTitle('Admin Users');
  const [draftByUserId, setDraftByUserId] = useState<Record<string, { name: string; role: 'USER' | 'ADMIN' }>>({});
  const [createForm, setCreateForm] = useState({ name: '', email: '', role: 'USER' as 'USER' | 'ADMIN' });
  const [creatingUser, setCreatingUser] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);

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
    nextRole: draftByUserId[u.id]?.role ?? u.role,
    nextName: draftByUserId[u.id]?.name ?? u.name ?? ''
  })), [users, draftByUserId]);

  const handleCreateUser = async () => {
    const email = createForm.email.trim().toLowerCase();
    const name = createForm.name.trim();
    if (!email) {
      toast.error('Email is required');
      return;
    }

    setCreatingUser(true);
    try {
      await api<User>('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email,
          name,
          role: createForm.role
        })
      });
      toast.success('User created');
      setCreateForm({ name: '', email: '', role: 'USER' });
      await refetchUsers();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create user');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleSaveUser = async (userId: string, nextName: string, nextRole: 'USER' | 'ADMIN') => {
    setSavingUserId(userId);
    try {
      await api<User>(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: nextName.trim(),
          role: nextRole
        })
      });
      toast.success('User updated');
      setDraftByUserId((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      await refetchUsers();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update user');
    } finally {
      setSavingUserId(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setDeletingUserId(userId);
    try {
      await api<{ deleted: boolean; id: string }>(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE'
      });
      toast.success('User deleted');
      setConfirmDeleteUserId(null);
      await refetchUsers();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete user');
    } finally {
      setDeletingUserId(null);
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
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Create User
            </CardTitle>
            <CardDescription className="mt-1">Add a new user and optionally grant ADMIN role.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Input
                placeholder="Full name"
                value={createForm.name}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
              />
              <Input
                type="email"
                placeholder="Email"
                value={createForm.email}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
              />
              <Select
                value={createForm.role}
                onValueChange={(v) => setCreateForm((prev) => ({ ...prev, role: v as 'USER' | 'ADMIN' }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">USER</SelectItem>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleCreateUser} disabled={creatingUser} className="md:justify-self-end">
                {creatingUser ? 'Creating...' : 'Create User'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="px-6 py-5 border-b border-border/50 bg-muted/30">
            <CardTitle className="text-lg font-bold">Admin Role Management</CardTitle>
            <CardDescription className="mt-1">Update user profile and roles, or remove users.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-background">
                  <tr>
                    <th className="text-left font-semibold p-3">Name</th>
                    <th className="text-left font-semibold p-3">Email</th>
                    <th className="text-left font-semibold p-3">Current Role</th>
                    <th className="text-left font-semibold p-3">Update</th>
                    <th className="text-left font-semibold p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => (
                    <tr key={u.id} className="border-b last:border-b-0">
                      <td className="p-3">
                        <Input
                          className="h-9 min-w-48"
                          value={u.nextName}
                          onChange={(e) =>
                            setDraftByUserId((prev) => ({
                              ...prev,
                              [u.id]: { name: e.target.value, role: prev[u.id]?.role ?? u.role }
                            }))
                          }
                        />
                      </td>
                      <td className="p-3 text-muted-foreground">{u.email}</td>
                      <td className="p-3">
                        <Badge variant={u.role === 'ADMIN' ? 'default' : 'outline'}>{u.role}</Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2 max-w-xs">
                          <Select
                            value={u.nextRole}
                            onValueChange={(v) =>
                              setDraftByUserId((prev) => ({
                                ...prev,
                                [u.id]: { name: prev[u.id]?.name ?? u.name ?? '', role: v as 'USER' | 'ADMIN' }
                              }))
                            }
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
                            disabled={
                              savingUserId === u.id ||
                              (u.nextRole === u.role && u.nextName.trim() === (u.name || '').trim())
                            }
                            onClick={() => handleSaveUser(u.id, u.nextName, u.nextRole)}
                          >
                            Save
                          </Button>
                        </div>
                      </td>
                      <td className="p-3">
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => setConfirmDeleteUserId(u.id)}
                          disabled={deletingUserId === u.id}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
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

      <AlertDialog open={!!confirmDeleteUserId} onOpenChange={(open) => !open && setConfirmDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently remove the selected user account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingUserId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!confirmDeleteUserId || !!deletingUserId}
              onClick={(e) => {
                e.preventDefault();
                if (!confirmDeleteUserId) return;
                void handleDeleteUser(confirmDeleteUserId);
              }}
            >
              {deletingUserId ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
