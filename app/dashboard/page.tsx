import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDashboardData } from '@/lib/dashboard';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { formatDate } from '@/lib/utils';
import { ClipboardList, Calendar, PlayCircle, CheckCircle2, ShieldAlert, Factory } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function StatCard({ title, value, icon: Icon, href }: { title: string; value: number; icon: React.ElementType; href?: string }) {
  const content = (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle>
        <Icon className="h-4 w-4 text-slate-400" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
  if (href) return <Link href={href} className="block">{content}</Link>;
  return content;
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.active) redirect('/login');

  const data = await getDashboardData({ id: session.user.id, role: session.user.role });
  const { stats } = data;

  return (
    <AppShell>
      <PageHeader title="Dashboard" description="Overview of your vendor compliance program" />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard title="Total Audits" value={stats.total} icon={ClipboardList} href="/audits" />
        <StatCard title="Scheduled" value={stats.scheduled} icon={Calendar} href="/audits" />
        <StatCard title="In Progress" value={stats.inProgress} icon={PlayCircle} href="/audits" />
        <StatCard title="Completed" value={stats.completed} icon={CheckCircle2} href="/reports" />
        <StatCard title="Open CAPs" value={stats.openCaps} icon={ShieldAlert} href="/caps" />
        <StatCard title="Factories" value={stats.factories} icon={Factory} href="/factories" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Audits</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.recentAudits.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No audits yet.</div>
          ) : (
            <div className="divide-y">
              {data.recentAudits.map((audit) => (
                <Link key={audit.id} href={`/audits/${audit.id}`} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 hover:bg-slate-50 transition-colors">
                  <div className="space-y-1">
                    <p className="font-medium">{audit.factoryName} — {audit.templateName}</p>
                    <p className="text-sm text-slate-500">
                      Auditor: {audit.auditorName || '-'} · Scheduled: {formatDate(audit.scheduledAt)} · {audit.itemCount} items
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {audit.overallScore !== null && audit.overallScore !== undefined && (
                      <span className="text-sm font-semibold text-slate-700">Score: {audit.overallScore.toFixed(1)}</span>
                    )}
                    {audit.capCount > 0 && <span className="text-sm text-red-600">{audit.capCount} CAPs</span>}
                    <StatusBadge status={audit.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
