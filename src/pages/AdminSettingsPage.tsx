import React, { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { api } from '@/lib/api-client';
import type { AppSettings } from '@shared/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ImageUp, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminSettingsPage() {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const heroInputRef = useRef<HTMLInputElement | null>(null);
  const appIconInputRef = useRef<HTMLInputElement | null>(null);
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [appName, setAppName] = useState('');
  const [appLabel, setAppLabel] = useState('');
  const [appIconUrl, setAppIconUrl] = useState('');

  const { data: settings, refetch: refetchSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<AppSettings>('/api/settings')
  });

  React.useEffect(() => {
    setAppName(settings?.appName || 'BookingTrack');
    setAppLabel(settings?.appLabel || 'Professional Venue Management');
    setAppIconUrl(settings?.appIconUrl || '');
  }, [settings?.appIconUrl, settings?.appLabel, settings?.appName]);

  const handleHeroUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const token = localStorage.getItem('nexus_token');
      const form = new FormData();
      form.append('file', file);
      form.append('docType', 'HERO');
      form.append('purpose', 'HeroImage');
      form.append('date', new Date().toISOString().slice(0, 10));

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Upload failed');
      }

      const url = json.data?.url as string | undefined;
      if (!url) throw new Error('Upload did not return a URL');

      await api('/api/settings/hero-image', {
        method: 'POST',
        body: JSON.stringify({ heroImageUrl: url })
      });
      await refetchSettings();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleIconUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const token = localStorage.getItem('nexus_token');
      const form = new FormData();
      form.append('file', file);
      form.append('docType', 'APP_ICON');
      form.append('purpose', 'AppIcon');
      form.append('date', new Date().toISOString().slice(0, 10));

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Upload failed');

      const url = json.data?.url as string | undefined;
      if (!url) throw new Error('Upload did not return a URL');
      setAppIconUrl(url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveBranding = async () => {
    setBrandingSaving(true);
    try {
      await api('/api/settings/branding', {
        method: 'POST',
        body: JSON.stringify({
          appName,
          appLabel,
          appIconUrl
        })
      });
      await refetchSettings();
      toast.success('Branding settings saved');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save branding settings');
    } finally {
      setBrandingSaving(false);
    }
  };

  return (
    <AppLayout container>
      <div className="space-y-8">
        <header className="relative overflow-hidden rounded-2xl bg-gradient-subtle p-8 border border-border/50">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-primary opacity-5 blur-3xl" />
          <div className="relative space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <Settings2 className="w-5 h-5" />
              <span className="text-sm font-medium uppercase tracking-wider">Settings</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Site Settings</h1>
            <p className="text-muted-foreground max-w-2xl">
              Update global visuals for the public landing page.
            </p>
          </div>
        </header>

        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="px-6 py-5 border-b border-border/50 bg-muted/30">
            <CardTitle className="text-lg font-bold">Branding</CardTitle>
            <CardDescription className="mt-1">
              Update app identity shown in sidebar and landing page.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">App Name</label>
                <Input value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="BookingTrack" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">App Label</label>
                <Input value={appLabel} onChange={(e) => setAppLabel(e.target.value)} placeholder="Professional Venue Management" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium">App Icon</div>
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-xl border bg-muted overflow-hidden flex items-center justify-center">
                  {appIconUrl ? (
                    <img src={appIconUrl} alt="App icon" className="h-full w-full object-cover" />
                  ) : (
                    <Settings2 className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleIconUpload(file);
                    e.currentTarget.value = '';
                  }}
                  disabled={uploading}
                  ref={appIconInputRef}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  disabled={uploading}
                  onClick={() => appIconInputRef.current?.click()}
                >
                  <ImageUp className="w-4 h-4" />
                  {uploading ? 'Uploading...' : 'Upload Icon'}
                </Button>
              </div>
              {uploadError && <div className="text-sm text-destructive">{uploadError}</div>}
            </div>

            <div className="pt-2">
              <Button onClick={handleSaveBranding} disabled={brandingSaving}>
                {brandingSaving ? 'Saving...' : 'Save Branding'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="px-6 py-5 border-b border-border/50 bg-muted/30">
            <CardTitle className="text-lg font-bold">Landing Hero Image</CardTitle>
            <CardDescription className="mt-1">
              Replace the homepage hero image shown to all visitors.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1">
                <div className="text-sm font-medium mb-2">Current Hero Image</div>
                <div className="aspect-[16/6] rounded-xl overflow-hidden border border-border/50 bg-muted">
                  <img
                    src={settings?.heroImageUrl || "/images/hero-painting.jpg"}
                    alt="Hero preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div className="w-full lg:w-80">
                <div className="text-sm font-medium mb-2">Upload New Image</div>
                <div className="rounded-xl border border-dashed border-border/70 p-4 space-y-3">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleHeroUpload(file);
                      e.currentTarget.value = '';
                    }}
                    disabled={uploading}
                    ref={heroInputRef}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2"
                    disabled={uploading}
                    onClick={() => heroInputRef.current?.click()}
                  >
                    <ImageUp className="w-4 h-4" />
                    {uploading ? 'Uploading...' : 'Choose Image'}
                  </Button>
                  {uploadError && (
                    <div className="text-sm text-destructive">{uploadError}</div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
