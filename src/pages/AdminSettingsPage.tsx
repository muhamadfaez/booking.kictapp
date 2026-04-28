import React, { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { api } from '@/lib/api-client';
import type { AppSettings } from '@shared/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Download, FileArchive, FileJson, FileSpreadsheet, ImageUp, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/use-page-title';

type BackupPayload = {
  exportedAt: string;
  users: Record<string, unknown>[];
  venues: Record<string, unknown>[];
  bookings: Record<string, unknown>[];
  managerAssignments: Record<string, unknown>[];
  roles: Record<string, unknown>[];
  auditTrail?: Record<string, unknown>[];
};

type BackupFormat = 'json' | 'csv' | 'excel';

const backupTables = (backup: BackupPayload) => ({
  users: backup.users,
  venues: backup.venues,
  bookings: backup.bookings,
  managerAssignments: backup.managerAssignments,
  roles: backup.roles,
  auditTrail: backup.auditTrail || []
});

const flattenRecord = (value: Record<string, unknown>) => {
  const output: Record<string, string | number | boolean | null> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === null || typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
      output[key] = entry;
    } else if (entry === undefined) {
      output[key] = null;
    } else {
      output[key] = JSON.stringify(entry);
    }
  }
  return output;
};

const csvEscape = (value: unknown) => {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const toCsv = (rows: Record<string, unknown>[]) => {
  const flattened = rows.map(flattenRecord);
  const headers = Array.from(new Set(flattened.flatMap((row) => Object.keys(row))));
  if (headers.length === 0) return '';
  return [
    headers.map(csvEscape).join(','),
    ...flattened.map((row) => headers.map((header) => csvEscape(row[header])).join(','))
  ].join('\r\n');
};

const xmlEscape = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const toExcelXml = (backup: BackupPayload) => {
  const sheets = Object.entries(backupTables(backup)).map(([name, rows]) => {
    const flattened = rows.map(flattenRecord);
    const headers = Array.from(new Set(flattened.flatMap((row) => Object.keys(row))));
    const headerRow = `<Row>${headers.map((header) => `<Cell><Data ss:Type="String">${xmlEscape(header)}</Data></Cell>`).join('')}</Row>`;
    const bodyRows = flattened.map((row) => (
      `<Row>${headers.map((header) => `<Cell><Data ss:Type="String">${xmlEscape(row[header])}</Data></Cell>`).join('')}</Row>`
    )).join('');
    return `<Worksheet ss:Name="${xmlEscape(name.slice(0, 31))}"><Table>${headerRow}${bodyRows}</Table></Worksheet>`;
  }).join('');

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${sheets}</Workbook>`;
};

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let j = 0; j < 8; j += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

const crc32 = (bytes: Uint8Array) => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const createZip = (files: Array<{ name: string; content: string }>) => {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  const writeHeader = (signature: number, fields: number[]) => {
    const buffer = new ArrayBuffer(fields.length * 2 + 4);
    const view = new DataView(buffer);
    view.setUint32(0, signature, true);
    fields.forEach((field, index) => view.setUint16(4 + index * 2, field, true));
    return new Uint8Array(buffer);
  };

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const contentBytes = encoder.encode(file.content);
    const crc = crc32(contentBytes);
    const localHeader = writeHeader(0x04034b50, [20, 0, 0, 0, 0, crc & 0xffff, crc >>> 16, contentBytes.length & 0xffff, contentBytes.length >>> 16, contentBytes.length & 0xffff, contentBytes.length >>> 16, nameBytes.length, 0]);
    localParts.push(localHeader, nameBytes, contentBytes);

    const centralHeader = writeHeader(0x02014b50, [20, 20, 0, 0, 0, 0, crc & 0xffff, crc >>> 16, contentBytes.length & 0xffff, contentBytes.length >>> 16, contentBytes.length & 0xffff, contentBytes.length >>> 16, nameBytes.length, 0, 0, 0, 0, 0, 0, offset & 0xffff, offset >>> 16]);
    centralParts.push(centralHeader, nameBytes);
    offset += localHeader.length + nameBytes.length + contentBytes.length;
  }

  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const end = writeHeader(0x06054b50, [0, 0, files.length, files.length, centralSize & 0xffff, centralSize >>> 16, offset & 0xffff, offset >>> 16, 0]);
  return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export default function AdminSettingsPage() {
  usePageTitle('Admin Settings');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const heroInputRef = useRef<HTMLInputElement | null>(null);
  const appIconInputRef = useRef<HTMLInputElement | null>(null);
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [appName, setAppName] = useState('');
  const [appLabel, setAppLabel] = useState('');
  const [appIconUrl, setAppIconUrl] = useState('');
  const [exportingFormat, setExportingFormat] = useState<BackupFormat | null>(null);

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

  const handleBackupExport = async (format: BackupFormat) => {
    setExportingFormat(format);
    try {
      const backup = await api<BackupPayload>('/api/admin/backup');
      const stamp = new Date().toISOString().slice(0, 10);

      if (format === 'json') {
        downloadBlob(
          new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
          `booking-backup-${stamp}.json`
        );
      } else if (format === 'csv') {
        const files = Object.entries(backupTables(backup)).map(([name, rows]) => ({
          name: `${name}.csv`,
          content: toCsv(rows)
        }));
        downloadBlob(createZip(files), `booking-backup-csv-${stamp}.zip`);
      } else {
        downloadBlob(
          new Blob([toExcelXml(backup)], { type: 'application/vnd.ms-excel' }),
          `booking-backup-${stamp}.xls`
        );
      }

      toast.success('Backup export started');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to export backup');
    } finally {
      setExportingFormat(null);
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
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Download className="w-4 h-4" />
              Data Backup
            </CardTitle>
            <CardDescription className="mt-1">
              Export users, venues, bookings, manager assignments, roles, and audit records.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Button
                type="button"
                variant="outline"
                className="h-12 justify-start gap-3"
                disabled={!!exportingFormat}
                onClick={() => handleBackupExport('json')}
              >
                <FileJson className="w-4 h-4" />
                {exportingFormat === 'json' ? 'Exporting JSON...' : 'Export as JSON'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 justify-start gap-3"
                disabled={!!exportingFormat}
                onClick={() => handleBackupExport('csv')}
              >
                <FileArchive className="w-4 h-4" />
                {exportingFormat === 'csv' ? 'Exporting CSV...' : 'Export as CSV'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 justify-start gap-3"
                disabled={!!exportingFormat}
                onClick={() => handleBackupExport('excel')}
              >
                <FileSpreadsheet className="w-4 h-4" />
                {exportingFormat === 'excel' ? 'Exporting Excel...' : 'Export as Excel'}
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
