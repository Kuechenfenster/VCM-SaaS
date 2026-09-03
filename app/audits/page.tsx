'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/status-badge';
import { toast } from 'sonner';
import Link from 'next/link';
import { Plus, Search, ClipboardList } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { formatDate } from '@/lib/utils';

const statusOptions = ['ALL', 'SCHEDULED', 'IN_PROGRESS', 'PAUSED', 'DRAFT', 'COMPLETED', 'CANCELLED'];

interface AuditListItem {
  id: string;
  status: string;
  scheduledAt: string | null;
  overallScore: number | null;
  factory: { name: string };
  template: { name: string };
  auditor: { name: string | null };
  _count: { caps: number; itemResults: number };
}

interface FactoryOption { id: string; name: string; }
interface TemplateOption { id: string; name: string; }
interface UserOption { id: string; name: string | null; email: string; }

export default function AuditsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';
  const [audits, setAudits] = useState<AuditListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [factories, setFactories] = useState<FactoryOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [form, setForm] = useState({ factoryId: '', templateId: '', auditorId: '', scheduledAt: '' });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const query = new URLSearchParams();
    if (status !== 'ALL') query.set('status', status);
    if (search) query.set('search', search);
    const res = await fetch(`/api/audits?${query.toString()}`);
    const data = await res.json();
    setAudits(data.audits || []);
    setLoading(false);
  }

  async function loadOptions() {
    const [fRes, tRes, uRes] = await Promise.all([
      fetch('/api/factories'),
      fetch('/api/templates'),
      isAdmin ? fetch('/api/users') : Promise.resolve(null),
    ]);
    const fData = await fRes.json();
    const tData = await tRes.json();
    setFactories(fData.factories || []);
    setTemplates(tData.templates || []);
    if (uRes) {
      const uData = await uRes.json();
      setUsers(uData.users || []);
    }
  }

  useEffect(() => {
    load();
    if (open) loadOptions();
  }, [status, search]);

  useEffect(() => {
    if (open) loadOptions();
  }, [open]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.factoryId || !form.templateId || !form.auditorId) {
      toast.error('Please select factory, template, and auditor');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/audits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success('Audit created');
      setOpen(false);
      setForm({ factoryId: '', templateId: '', auditorId: '', scheduledAt: '' });
      load();
    } else {
      toast.error('Failed to create audit');
    }
  }

  return (
    <AppShell>
      <PageHeader title="Audits" description="Manage and conduct factory audits">
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> New Audit</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>Create Audit</DialogTitle>
                  <DialogDescription>Schedule a new audit for a factory.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Factory</Label>
                    <Select value={form.factoryId} onValueChange={(v) => setForm({ ...form, factoryId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select factory" /></SelectTrigger>
                      <SelectContent>
                        {factories.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Template</Label>
                    <Select value={form.templateId} onValueChange={(v) => setForm({ ...form, templateId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                      <SelectContent>
                        {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Auditor</Label>
                    <Select value={form.auditorId} onValueChange={(v) => setForm({ ...form, auditorId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select auditor" /></SelectTrigger>
                      <SelectContent>
                        {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="scheduledAt">Scheduled At</Label>
                    <Input id="scheduledAt" type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Schedule Audit'}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </PageHeader>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Search audits..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusOptions.map((s) => <SelectItem key={s} value={s}>{s === 'ALL' ? 'All Statuses' : s.replace(/_/g, ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : audits.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="mx-auto h-8 w-8 text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">No audits found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Factory</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Auditor</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audits.map((audit) => (
                  <TableRow key={audit.id} className="cursor-pointer">
                    <TableCell>
                      <Link href={`/audits/${audit.id}`} className="font-medium hover:underline">{audit.factory.name}</Link>
                    </TableCell>
                    <TableCell>{audit.template.name}</TableCell>
                    <TableCell>{audit.auditor.name || '-'}</TableCell>
                    <TableCell>{formatDate(audit.scheduledAt)}</TableCell>
                    <TableCell>{audit.overallScore !== null && audit.overallScore !== undefined ? audit.overallScore.toFixed(1) : '-'}</TableCell>
                    <TableCell className="text-right"><StatusBadge status={audit.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
