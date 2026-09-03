'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/status-badge';
import { toast } from 'sonner';
import { FileText, Download } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface CompletedAudit {
  id: string;
  status: string;
  scheduledAt: string | null;
  endTime: string | null;
  overallScore: number | null;
  totalDuration: number;
  factory: { name: string };
  template: { name: string };
  auditor: { name: string | null };
  _count: { caps: number };
}

export default function ReportsPage() {
  const [audits, setAudits] = useState<CompletedAudit[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/audits?status=COMPLETED');
    const data = await res.json();
    setAudits(data.audits || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function downloadReport(auditId: string) {
    const res = await fetch(`/api/reports/${auditId}`);
    if (!res.ok) {
      toast.error('Failed to generate report');
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-report-${auditId}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  return (
    <AppShell>
      <PageHeader title="Reports" description="Download PDF reports for completed audits" />

      <Card>
        <CardContent className="p-4">
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : audits.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-8 w-8 text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">No completed audits yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Factory</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Auditor</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audits.map((audit) => (
                  <TableRow key={audit.id}>
                    <TableCell className="font-medium">{audit.factory.name}</TableCell>
                    <TableCell>{audit.template.name}</TableCell>
                    <TableCell>{audit.auditor.name || '-'}</TableCell>
                    <TableCell>{formatDate(audit.endTime)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{audit.overallScore !== null && audit.overallScore !== undefined ? audit.overallScore.toFixed(1) : '-'}</span>
                        {audit._count.caps > 0 && <span className="text-xs text-red-600">{audit._count.caps} CAPs</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => downloadReport(audit.id)} className="gap-1">
                        <Download className="h-4 w-4" /> PDF
                      </Button>
                    </TableCell>
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
