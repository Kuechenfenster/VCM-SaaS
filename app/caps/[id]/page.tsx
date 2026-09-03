'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { StatusBadge } from '@/components/status-badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import Link from 'next/link';
import { Upload, Trash2, FileText } from 'lucide-react';

interface CAPDetail {
  id: string;
  status: string;
  finding: string;
  correctiveAction: string | null;
  targetDate: string | null;
  planDate: string | null;
  actionDate: string | null;
  verifiedBy: string | null;
  audit: { id: string; status: string; factory: { id: string; name: string }; template: { name: string }; auditor: { name: string | null } };
  itemResult: { item: { text: string }; score: number | null; findings: string | null; photos: { id: string; cloudStoragePath: string; caption: string | null }[] };
  attachments: CAPAttachment[];
}

interface CAPAttachment {
  id: string;
  cloudStoragePath: string;
  fileName: string;
  mimeType: string | null;
  createdAt: string;
}

export default function CAPDetailPage() {
  const { id } = useParams() as { id: string };
  const [cap, setCap] = useState<CAPDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/caps/${id}`);
    if (res.ok) {
      const data = await res.json();
      setCap(data.cap);
    } else {
      toast.error('CAP not found');
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function saveField(patch: Partial<CAPDetail>) {
    if (!cap) return;
    setSaving(true);
    const res = await fetch(`/api/caps/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    if (res.ok) {
      toast.success('CAP updated');
      load();
    } else {
      toast.error('Failed to update CAP');
    }
  }

  async function uploadFile(file: File) {
    const presigned = await fetch('/api/upload/presigned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: file.name, contentType: file.type || 'application/octet-stream' }),
    }).then((r) => r.json());

    const uploadRes = await fetch(presigned.url, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
    });
    if (!uploadRes.ok) throw new Error('Upload failed');
    return presigned.key as string;
  }

  async function handleAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const key = await uploadFile(file);
      const res = await fetch(`/api/caps/${id}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloudStoragePath: key, fileName: file.name, mimeType: file.type }),
      });
      if (!res.ok) throw new Error('Failed to save attachment');
      toast.success('Attachment added');
      load();
    } catch {
      toast.error('Attachment upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function deleteAttachment(attachmentId: string) {
    if (!confirm('Delete this attachment?')) return;
    const res = await fetch(`/api/caps/${id}/attachments/${attachmentId}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Attachment deleted');
      load();
    } else {
      toast.error('Failed to delete attachment');
    }
  }

  if (loading) return <AppShell><div className="p-6">Loading...</div></AppShell>;
  if (!cap) return <AppShell><div className="p-6">CAP not found.</div></AppShell>;

  return (
    <AppShell>
      <PageHeader title={`CAP — ${cap.audit.factory.name}`} description={cap.itemResult.item.text}>
        <Button variant="outline" asChild className="gap-2">
          <Link href={`/audits/${cap.audit.id}`}>View Audit</Link>
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>CAP Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={cap.status} onValueChange={(v) => saveField({ status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">Open</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="RESOLVED">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="verifiedBy">Verified By</Label>
                <Input id="verifiedBy" defaultValue={cap.verifiedBy || ''} onBlur={(e) => saveField({ verifiedBy: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="targetDate">Target Date</Label>
                <Input id="targetDate" type="date" defaultValue={cap.targetDate ? cap.targetDate.slice(0, 10) : ''} onBlur={(e) => saveField({ targetDate: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="planDate">Plan Date</Label>
                <Input id="planDate" type="date" defaultValue={cap.planDate ? cap.planDate.slice(0, 10) : ''} onBlur={(e) => saveField({ planDate: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="actionDate">Action Date</Label>
                <Input id="actionDate" type="date" defaultValue={cap.actionDate ? cap.actionDate.slice(0, 10) : ''} onBlur={(e) => saveField({ actionDate: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="finding">Finding</Label>
              <Textarea id="finding" defaultValue={cap.finding} onBlur={(e) => saveField({ finding: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="correctiveAction">Corrective Action</Label>
              <Textarea id="correctiveAction" defaultValue={cap.correctiveAction || ''} onBlur={(e) => saveField({ correctiveAction: e.target.value })} />
            </div>

            {saving && <p className="text-xs text-slate-500">Saving...</p>}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Evidence Photos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cap.itemResult.photos.length === 0 ? (
                <p className="text-sm text-slate-500">No evidence photos.</p>
              ) : (
                cap.itemResult.photos.map((photo) => (
                  <div key={photo.id} className="rounded-md border overflow-hidden">
                    <img src={photo.cloudStoragePath} alt={photo.caption || ''} className="w-full h-40 object-cover" />
                    <p className="p-2 text-sm">{photo.caption || 'Evidence'}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Attachments</CardTitle>
              <input type="file" className="hidden" ref={fileInputRef} onChange={handleAttachment} />
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-1">
                <Upload className="h-4 w-4" /> {uploading ? 'Uploading...' : 'Upload'}
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {cap.attachments.length === 0 ? (
                <p className="text-sm text-slate-500">No attachments.</p>
              ) : (
                cap.attachments.map((att) => (
                  <div key={att.id} className="flex items-center justify-between rounded-md border p-2">
                    <a href={att.cloudStoragePath} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm hover:underline">
                      <FileText className="h-4 w-4" />
                      <span className="truncate max-w-[180px]">{att.fileName}</span>
                    </a>
                    <Button size="icon" variant="ghost" className="text-red-600 h-8 w-8" onClick={() => deleteAttachment(att.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
