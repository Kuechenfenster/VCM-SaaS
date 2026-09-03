'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/status-badge';
import { toast } from 'sonner';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { formatDate } from '@/lib/utils';

interface FactoryDetail {
  id: string;
  name: string;
  vendorName: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  audits: { id: string; status: string; scheduledAt: string | null; overallScore: number | null }[];
  _count: { audits: number };
}

export default function FactoryDetailPage() {
  const { id } = useParams() as { id: string };
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';
  const [factory, setFactory] = useState<FactoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/factories/${id}`);
    if (res.ok) {
      const data = await res.json();
      setFactory(data.factory);
    } else {
      toast.error('Factory not found');
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!factory) return;
    setSaving(true);
    const res = await fetch(`/api/factories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(factory),
    });
    setSaving(false);
    if (res.ok) {
      toast.success('Factory updated');
    } else {
      toast.error('Failed to update factory');
    }
  }

  if (loading) return <AppShell><div className="p-6">Loading...</div></AppShell>;
  if (!factory) return <AppShell><div className="p-6">Factory not found.</div></AppShell>;

  return (
    <AppShell>
      <PageHeader title={factory.name} description={factory.vendorName || undefined}>
        {isAdmin && <Button type="submit" form="factory-form" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>}
      </PageHeader>

      <form id="factory-form" onSubmit={handleSave} className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Factory Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" required value={factory.name} onChange={(e) => setFactory({ ...factory, name: e.target.value })} disabled={!isAdmin} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vendorName">Vendor Name</Label>
              <Input id="vendorName" value={factory.vendorName || ''} onChange={(e) => setFactory({ ...factory, vendorName: e.target.value })} disabled={!isAdmin} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" value={factory.city || ''} onChange={(e) => setFactory({ ...factory, city: e.target.value })} disabled={!isAdmin} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="country">Country</Label>
                <Input id="country" value={factory.country || ''} onChange={(e) => setFactory({ ...factory, country: e.target.value })} disabled={!isAdmin} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" value={factory.address || ''} onChange={(e) => setFactory({ ...factory, address: e.target.value })} disabled={!isAdmin} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={factory.notes || ''} onChange={(e) => setFactory({ ...factory, notes: e.target.value })} disabled={!isAdmin} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="contactName">Contact Name</Label>
                <Input id="contactName" value={factory.contactName || ''} onChange={(e) => setFactory({ ...factory, contactName: e.target.value })} disabled={!isAdmin} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contactEmail">Email</Label>
                <Input id="contactEmail" type="email" value={factory.contactEmail || ''} onChange={(e) => setFactory({ ...factory, contactEmail: e.target.value })} disabled={!isAdmin} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contactPhone">Phone</Label>
                <Input id="contactPhone" value={factory.contactPhone || ''} onChange={(e) => setFactory({ ...factory, contactPhone: e.target.value })} disabled={!isAdmin} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Audits ({factory._count.audits})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {factory.audits.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">No audits yet.</p>
              ) : (
                <div className="divide-y">
                  {factory.audits.map((audit) => (
                    <Link key={audit.id} href={`/audits/${audit.id}`} className="flex items-center justify-between p-3 hover:bg-slate-50">
                      <div>
                        <p className="text-sm">{formatDate(audit.scheduledAt)}</p>
                        {audit.overallScore !== null && audit.overallScore !== undefined && <p className="text-xs text-slate-500">Score {audit.overallScore.toFixed(1)}</p>}
                      </div>
                      <StatusBadge status={audit.status} />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </form>
    </AppShell>
  );
}
