import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AuditStatus, CAPStatus } from '@prisma/client';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.active) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const where = session.user.role === 'ADMIN' ? {} : { auditorId: session.user.id };

  const [total, scheduled, inProgress, completed, openCaps, factories, recentAudits] = await Promise.all([
    prisma.audit.count({ where }),
    prisma.audit.count({ where: { ...where, status: AuditStatus.SCHEDULED } }),
    prisma.audit.count({ where: { ...where, status: AuditStatus.IN_PROGRESS } }),
    prisma.audit.count({ where: { ...where, status: AuditStatus.COMPLETED } }),
    prisma.cAP.count({ where: session.user.role === 'ADMIN' ? { status: CAPStatus.OPEN } : { status: CAPStatus.OPEN, audit: { auditorId: session.user.id } } }),
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

  return NextResponse.json({
    stats: { total, scheduled, inProgress, completed, openCaps, factories },
    recentAudits: recentAudits.map((a) => ({
      id: a.id,
      status: a.status,
      factoryName: a.factory.name,
      templateName: a.template.name,
      auditorName: a.auditor.name,
      scheduledAt: a.scheduledAt,
      overallScore: a.overallScore,
      capCount: a._count.caps,
      itemCount: a._count.itemResults,
    })),
  });
}
