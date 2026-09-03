'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/status-badge';
import { toast } from 'sonner';
import Link from 'next/link';
import { Download, Search, ShieldCheck, ShieldAlert, Clock, CheckCircle2 } from 'lucide-react';

interface CAPItem {
  id: string;
  status: string;
  finding: string;
  correctiveAction: string | null;
  targetDate: string | null;
  createdAt: string;
  audit: { id: string; factory: { name: string }; template: { name: string }; auditor: { name: string | null } };
  itemResult: { item: { text: string } };
  _count: { attachments: number };
}

interface CAPStats {
  open: number;
  inProgress: number;
  resolved: number;
  total: number;
}

export default function CAPsPage() {
  const [caps, setCaps] = useState<CAPItem[]>([]);
  const [stats, setStats] = useState<CAPStats>({ open: 0, inProgress: 0, resolved: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    const query = new URLSearchParams();
    if (status !== 'ALL') query.set('status', status);
    query.set('sortBy', sortBy);
    query.set('sortOrder', sortOrder);
    const res = await fetch(`/api/caps?${query.toString()}`);
    const data = await res.json();
    setCaps(data.caps || []);
    setStats(data.stats || { open: 0, inProgress: 0, resolved: 0, total: 0 });
    setLoading(false);
  }

  useEffect(() => { load(); }, [status, sortBy, sortOrder]);

  async function exportExcel() {
    const res = await fetch('/api/caps/export');
    if (!res.ok) {
      toast.error('Export failed');
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'caps-export.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  }

  const filtered = caps.filter((c) =>
    `${c.finding} ${c.audit.factory.name} ${c.itemResult.item.text}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <PageHeader title="Corrective Action Plans" description="Track and manage audit CAPs">
        <Button variant="outline" onClick={exportExcel} className="gap-2">
          <Download className="h-4 w-4" /> Export Excel
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-red-600" />
            <div>
              <p className="text-sm text-slate-500">Open</p>
              <p className="text-xl font-bold">{stats.open}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-600" />
            <div>
              <p className="text-sm text-slate-500">In Progress</p>
              <p className="text-xl font-bold">{stats.inProgress}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-sm text-slate-500">Resolved</p>
              <p className="text-xl font-bold">{stats.resolved}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm text-slate-500">Total</p>
              <p className="text-xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Search CAPs..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v)}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">Created Date</SelectItem>
                <SelectItem value="targetDate">Target Date</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as 'asc' | 'desc')}>
              <SelectTrigger className="w-full sm:w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Desc</SelectItem>
                <SelectItem value="asc">Asc</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-slate-500">No CAPs found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Factory</TableHead>
                  <TableHead>Finding</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Target Date</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((cap) => (
                  <TableRow key={cap.id} className="cursor-pointer">
                    <TableCell>
                      <Link href={`/caps/${cap.id}`} className="font-medium hover:underline">{cap.audit.factory.name}</Link>
                      <p className="text-xs text-slate-500">{cap.audit.template.name}</p>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{cap.finding}</TableCell>
                    <TableCell className="max-w-xs truncate">{cap.itemResult.item.text}</TableCell>
                    <TableCell>{cap.targetDate ? new Date(cap.targetDate).toLocaleDateString() : '-'}</TableCell>
                    <TableCell className="text-right"><StatusBadge status={cap.status} /></TableCell>
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
