import { prisma } from '@/lib/prisma';
import { AuditStatus, CAPStatus } from '@prisma/client';

export interface DashboardData {
  stats: {
    total: number;
    scheduled: number;
    inProgress: number;
    completed: number;
    openCaps: number;
    factories: number;
  };
  recentAudits: {
    id: string;
    status: string;
    factoryName: string;
    templateName: string;
    auditorName: string | null;
    scheduledAt: string | null;
    overallScore: number | null;
    capCount: number;
    itemCount: number;
  }[];
}

export async function getDashboardData(user: { id: string; role: string }): Promise<DashboardData> {
  const where = user.role === 'ADMIN' ? {} : { auditorId: user.id };

  const [total, scheduled, inProgress, completed, openCaps, factories, recentAudits] = await Promise.all([
    prisma.audit.count({ where }),
    prisma.audit.count({ where: { ...where, status: AuditStatus.SCHEDULED } }),
    prisma.audit.count({ where: { ...where, status: AuditStatus.IN_PROGRESS } }),
    prisma.audit.count({ where: { ...where, status: AuditStatus.COMPLETED } }),
    prisma.cAP.count({
      where: user.role === 'ADMIN'
        ? { status: CAPStatus.OPEN }
        : { status: CAPStatus.OPEN, audit: { auditorId: user.id } },
    }),
    prisma.factory.count(),
    prisma.audit.findMany({
      where,
      take: 5,
      orderBy: { updatedAt: 'desc' },
      include: {
        factory: { select: { name: true } },
        template: { select: { name: true } },
        auditor: { select: { name: true } },
        _count: { select: { caps: true, itemResults: true } },
      },
    }),
  ]);

  return {
    stats: { total, scheduled, inProgress, completed, openCaps, factories },
    recentAudits: recentAudits.map((a) => ({
      id: a.id,
      status: a.status,
      factoryName: a.factory.name,
      templateName: a.template.name,
      auditorName: a.auditor.name,
      scheduledAt: a.scheduledAt ? a.scheduledAt.toISOString() : null,
      overallScore: a.overallScore === null || a.overallScore === undefined ? null : Number(a.overallScore),
      capCount: a._count.caps,
      itemCount: a._count.itemResults,
    })),
  };
}
