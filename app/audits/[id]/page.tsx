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
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from '@/components/status-badge';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';
import { formatDuration, formatDateTime } from '@/lib/utils';
import { Camera, ImageIcon, Flag, Upload, Play, Pause, CheckCircle2, Save, MapPin } from 'lucide-react';
import Link from 'next/link';

interface AuditDetail {
  id: string;
  status: string;
  scheduledAt: string | null;
  startTime: string | null;
  endTime: string | null;
  totalDuration: number;
  lastResumedAt: string | null;
  overallScore: number | null;
  notes: string | null;
  factory: { id: string; name: string; vendorName: string | null; city: string | null; country: string | null };
  template: { id: string; name: string; code: string };
  auditor: { id: string; name: string | null };
  sections: AuditSection[];
  photos: Photo[];
  gpsLogs: { latitude: number; longitude: number }[];
}

interface AuditSection {
  id: string;
  title: string;
  sortOrder: number;
  score: number | null;
  maxScore: number | null;
  items: AuditItemResult[];
}

interface AuditItemResult {
  id: string;
  result: 'PASS' | 'FAIL' | 'NA' | null;
  score: number | null;
  findings: string | null;
  remarks: string | null;
  requiresCap: boolean;
  item: { id: string; text: string; maxScore: number };
  photos: Photo[];
  cap: { id: string; status: string } | null;
}

interface Photo {
  id: string;
  cloudStoragePath: string;
  caption: string | null;
  itemResultId: string | null;
}

export default function AuditDetailPage() {
  const { id } = useParams() as { id: string };
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';
  const [audit, setAudit] = useState<AuditDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());

  // Camera/gallery
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/audits/${id}`);
    if (res.ok) {
      const data = await res.json();
      setAudit(data.audit);
    } else {
      toast.error('Failed to load audit');
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  // Timer tick
  useEffect(() => {
    if (audit?.status !== 'IN_PROGRESS') return;
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [audit?.status, audit?.lastResumedAt]);

  // GPS logging while in progress
  useEffect(() => {
    if (audit?.status !== 'IN_PROGRESS') return;
    if (!navigator.geolocation) return;
    const logPosition = () => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          await fetch(`/api/audits/${id}/gps`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            }),
          });
        },
        () => {},
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    };
    logPosition();
    const interval = setInterval(logPosition, 60000);
    return () => clearInterval(interval);
  }, [audit?.status, id]);

  function currentDuration() {
    let duration = audit?.totalDuration || 0;
    if (audit?.status === 'IN_PROGRESS' && audit?.lastResumedAt) {
      duration += Math.floor((nowTick - new Date(audit.lastResumedAt).getTime()) / 1000);
    }
    return duration;
  }

  async function updateStatus(status: string) {
    setUpdatingStatus(true);
    const res = await fetch(`/api/audits/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setUpdatingStatus(false);
    if (res.ok) {
      toast.success(`Audit ${status.toLowerCase().replace(/_/g, ' ')}`);
      load();
    } else {
      toast.error('Failed to update audit status');
    }
  }

  async function completeAudit() {
    setUpdatingStatus(true);
    const res = await fetch(`/api/audits/${id}/complete`, { method: 'POST' });
    setUpdatingStatus(false);
    if (res.ok) {
      toast.success('Audit completed');
      load();
    } else {
      toast.error('Failed to complete audit');
    }
  }

  async function updateItem(itemResultId: string, patch: Partial<AuditItemResult>) {
    const res = await fetch(`/api/audits/${id}/items`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemResultId, ...patch }),
    });
    if (res.ok) {
      // Update local state optimistically
      setAudit((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sections: prev.sections.map((section) => ({
            ...section,
            items: section.items.map((item) => (item.id === itemResultId ? { ...item, ...patch } : item)),
          })),
        };
      });
      if (patch.requiresCap) toast.success('CAP flagged');
    } else {
      toast.error('Failed to update item');
    }
  }

  function editable() {
    return audit?.status === 'IN_PROGRESS';
  }

  function readOnly() {
    return ['PAUSED', 'DRAFT', 'COMPLETED', 'CANCELLED'].includes(audit?.status || '');
  }

  async function uploadFile(file: File | Blob, fileName: string, contentType: string) {
    const presigned = await fetch('/api/upload/presigned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, contentType }),
    }).then((r) => r.json());

    const uploadRes = await fetch(presigned.url, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': contentType },
    });
    if (!uploadRes.ok) throw new Error('Upload failed');
    return presigned.key as string;
  }

  async function savePhoto(cloudStoragePath: string) {
    const res = await fetch('/api/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auditId: id,
        itemResultId: selectedItemId,
        cloudStoragePath,
        caption,
        isPublic: false,
      }),
    });
    if (!res.ok) throw new Error('Failed to save photo');
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraActive(true);
    } catch {
      toast.error('Could not access camera');
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }

  async function capturePhoto() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setUploading(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (!blob) throw new Error('Canvas empty');
      const key = await uploadFile(blob, `audit-${id}-${Date.now()}.jpg`, 'image/jpeg');
      await savePhoto(key);
      toast.success('Photo saved');
      setPhotoDialogOpen(false);
      setCaption('');
      stopCamera();
      load();
    } catch (e) {
      toast.error('Photo capture failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const key = await uploadFile(file, `${Date.now()}-${file.name}`, file.type || 'application/octet-stream');
      await savePhoto(key);
      toast.success('Photo uploaded');
      setPhotoDialogOpen(false);
      setCaption('');
      load();
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  }

  const auditStatus = audit?.status || '';

  if (loading) return <AppShell><div className="p-6">Loading...</div></AppShell>;
  if (!audit) return <AppShell><div className="p-6">Audit not found.</div></AppShell>;

  return (
    <AppShell>
      <PageHeader title={`${audit.factory.name} — ${audit.template.name}`} description={`Auditor: ${audit.auditor.name || '-'} · Scheduled: ${formatDateTime(audit.scheduledAt)}`}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-mono">
            <span className="text-slate-500">Timer:</span>
            <span className="font-semibold">{formatDuration(currentDuration())}</span>
          </div>
          {auditStatus === 'SCHEDULED' && (
            <Button onClick={() => updateStatus('IN_PROGRESS')} disabled={updatingStatus} className="gap-2">
              <Play className="h-4 w-4" /> Start
            </Button>
          )}
          {auditStatus === 'IN_PROGRESS' && (
            <>
              <Button variant="outline" onClick={() => updateStatus('PAUSED')} disabled={updatingStatus} className="gap-2">
                <Pause className="h-4 w-4" /> Pause
              </Button>
              <Button variant="secondary" onClick={() => updateStatus('DRAFT')} disabled={updatingStatus} className="gap-2">
                <Save className="h-4 w-4" /> Save Draft
              </Button>
              <Button onClick={completeAudit} disabled={updatingStatus} className="gap-2">
                <CheckCircle2 className="h-4 w-4" /> Complete
              </Button>
            </>
          )}
          {(auditStatus === 'PAUSED' || auditStatus === 'DRAFT') && (
            <Button onClick={() => updateStatus('IN_PROGRESS')} disabled={updatingStatus} className="gap-2">
              <Play className="h-4 w-4" /> Resume
            </Button>
          )}
        </div>
      </PageHeader>

      {readOnly() && (
        <div className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800 border border-amber-200">
          This audit is {audit.status.toLowerCase().replace(/_/g, ' ')} and is read-only.
        </div>
      )}

      <Tabs defaultValue="checklist" className="space-y-6">
        <TabsList>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="photos">Photos ({audit.photos.length})</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="checklist" className="space-y-6">
          {audit.sections.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-slate-500 mb-4">Start the audit to load the checklist.</p>
                {auditStatus === 'SCHEDULED' && <Button onClick={() => updateStatus('IN_PROGRESS')} disabled={updatingStatus}>Start Audit</Button>}
              </CardContent>
            </Card>
          ) : (
            audit.sections.map((section) => (
              <Card key={section.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle>{section.title}</CardTitle>
                    {section.score !== null && section.score !== undefined && (
                      <Badge variant="outline">Section score: {section.score.toFixed(1)} / {section.maxScore || 5}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {section.items.map((item) => (
                    <div key={item.id} className="rounded-lg border p-3 sm:p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <p className="font-medium text-sm sm:text-base">{item.item.text}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant={item.result === 'PASS' ? 'default' : 'outline'}
                            disabled={!editable()}
                            onClick={() => updateItem(item.id, { result: 'PASS', score: item.item.maxScore, requiresCap: false })}
                            className="min-h-[44px]"
                          >
                            PASS
                          </Button>
                          <Button
                            size="sm"
                            variant={item.result === 'FAIL' ? 'destructive' : 'outline'}
                            disabled={!editable()}
                            onClick={() => updateItem(item.id, { result: 'FAIL', score: 0, requiresCap: true })}
                            className="min-h-[44px]"
                          >
                            FAIL
                          </Button>
                          <Button
                            size="sm"
                            variant={item.result === 'NA' ? 'secondary' : 'outline'}
                            disabled={!editable()}
                            onClick={() => updateItem(item.id, { result: 'NA', score: null, requiresCap: false })}
                            className="min-h-[44px]"
                          >
                            N/A
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Score (max {item.item.maxScore})</Label>
                          <Input
                            type="number"
                            min={0}
                            max={item.item.maxScore}
                            step={0.5}
                            disabled={!editable() || item.result === 'NA'}
                            defaultValue={item.score ?? ''}
                            key={item.id}
                            onBlur={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val)) updateItem(item.id, { score: Math.min(item.item.maxScore, Math.max(0, val)) });
                            }}
                          />
                        </div>
                      </div>

                      <div className="grid gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Findings</Label>
                          <Textarea
                            placeholder="Describe findings..."
                            disabled={!editable()}
                            defaultValue={item.findings || ''}
                            key={`${item.id}-findings`}
                            onBlur={(e) => updateItem(item.id, { findings: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Remarks</Label>
                          <Textarea
                            placeholder="Remarks..."
                            disabled={!editable()}
                            defaultValue={item.remarks || ''}
                            key={`${item.id}-remarks`}
                            onBlur={(e) => updateItem(item.id, { remarks: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {item.result === 'FAIL' && (
                          <Button
                            size="sm"
                            variant={item.requiresCap || item.cap ? 'destructive' : 'outline'}
                            disabled={!editable()}
                            onClick={() => updateItem(item.id, { requiresCap: true })}
                            className="gap-2 min-h-[44px]"
                          >
                            <Flag className="h-4 w-4" /> {item.cap ? 'CAP Linked' : 'Flag CAP'}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!editable()}
                          onClick={() => {
                            setSelectedItemId(item.id);
                            setPhotoDialogOpen(true);
                            startCamera();
                          }}
                          className="gap-2 min-h-[44px]"
                        >
                          <Camera className="h-4 w-4" /> Photo
                        </Button>
                        {item.photos.length > 0 && <Badge variant="outline">{item.photos.length} photo(s)</Badge>}
                        {item.cap && <Link href={`/caps/${item.cap.id}`}><Badge variant="destructive" className="cursor-pointer">CAP {item.cap.status}</Badge></Link>}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="photos">
          <Card>
            <CardHeader>
              <CardTitle>Photo Evidence</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {audit.photos.length === 0 ? (
                <p className="text-sm text-slate-500 col-span-full">No photos yet.</p>
              ) : (
                audit.photos.map((photo) => (
                  <div key={photo.id} className="rounded-lg border overflow-hidden">
                    <img src={photo.cloudStoragePath} alt={photo.caption || 'Photo'} className="w-full h-48 object-cover" />
                    <div className="p-2">
                      <p className="text-sm font-medium truncate">{photo.caption || 'Untitled'}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Audit Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Status</p>
                  <StatusBadge status={audit.status} />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Overall Score</p>
                  <p className="font-semibold">{audit.overallScore !== null && audit.overallScore !== undefined ? audit.overallScore.toFixed(1) : '-'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Start Time</p>
                  <p className="font-medium">{formatDateTime(audit.startTime)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">End Time</p>
                  <p className="font-medium">{formatDateTime(audit.endTime)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Total Duration</p>
                  <p className="font-medium">{formatDuration(audit.totalDuration)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">GPS Logs</p>
                  <p className="font-medium">{audit.gpsLogs.length > 0 ? `${audit.gpsLogs[0].latitude.toFixed(4)}, ${audit.gpsLogs[0].longitude.toFixed(4)}` : '-'}</p>
                </div>
              </div>
              <Separator />
              <div className="space-y-1">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  disabled={!editable()}
                  defaultValue={audit.notes || ''}
                  key={`${audit.id}-notes`}
                  onBlur={(e) => {
                    fetch(`/api/audits/${id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ notes: e.target.value }),
                    });
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={photoDialogOpen} onOpenChange={(open) => {
        setPhotoDialogOpen(open);
        if (!open) stopCamera();
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Photo Evidence</DialogTitle>
            <DialogDescription>Capture from camera or choose from gallery.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="relative aspect-video rounded-md bg-black overflow-hidden">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover">Video not supported.</video>
              {!cameraActive && <div className="absolute inset-0 flex items-center justify-center text-white text-sm">Camera inactive</div>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="caption">Caption</Label>
              <Input id="caption" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Photo caption" />
            </div>
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
                <Upload className="h-4 w-4" /> Gallery
              </Button>
              <Button type="button" onClick={capturePhoto} disabled={!cameraActive || uploading} className="gap-2">
                <Camera className="h-4 w-4" /> {uploading ? 'Saving...' : 'Capture'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
