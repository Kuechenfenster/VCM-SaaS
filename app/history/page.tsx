'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '@/lib/utils';

interface HistoryEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  changes: Record<string, unknown> | null;
  createdAt: string;
  user: { name: string | null; email: string };
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');

  async function load() {
    setLoading(true);
    const query = new URLSearchParams();
    if (entityType) query.set('entityType', entityType);
    if (entityId) query.set('entityId', entityId);
    const res = await fetch(`/api/history?${query.toString()}`);
    const data = await res.json();
    setHistory(data.history || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <AppShell>
      <PageHeader title="Change History" description="Audit trail of changes across the platform" />

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="space-y-1 flex-1">
              <Label className="text-xs">Entity Type</Label>
              <Input placeholder="e.g. Audit, CAP, Factory" value={entityType} onChange={(e) => setEntityType(e.target.value)} />
            </div>
            <div className="space-y-1 flex-1">
              <Label className="text-xs">Entity ID</Label>
              <Input placeholder="Entity UUID" value={entityId} onChange={(e) => setEntityId(e.target.value)} />
            </div>
            <Button onClick={load} className="self-end" disabled={loading}>{loading ? 'Loading...' : 'Search'}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {history.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No history entries found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Changes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(entry.createdAt)}</TableCell>
                    <TableCell>{entry.user.name || entry.user.email}</TableCell>
                    <TableCell><span className="font-medium">{entry.action}</span></TableCell>
                    <TableCell>{entry.entityType} <span className="text-xs text-slate-500">{entry.entityId.slice(0, 8)}</span></TableCell>
                    <TableCell className="max-w-xs truncate text-xs">{entry.changes ? JSON.stringify(entry.changes) : '-'}</TableCell>
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
