import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { recordChange } from '@/lib/history';
import { AuditStatus } from '@prisma/client';
import { z } from 'zod';

const updateSchema = z.object({
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'PAUSED', 'DRAFT', 'COMPLETED', 'CANCELLED']).optional(),
  notes: z.string().optional(),
  scheduledAt: z.string().datetime().optional().or(z.literal('')),
  auditorId: z.string().optional(),
});

async function ensureAuditSections(auditId: string) {
  const existing = await prisma.auditSection.findMany({ where: { auditId } });
  if (existing.length > 0) return;

  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    include: {
      template: {
        include: {
          sections: { orderBy: { sortOrder: 'asc' }, include: { items: { orderBy: { sortOrder: 'asc' } } } },
        },
      },
    },
  });
  if (!audit) return;

  for (const section of audit.template.sections) {
    const auditSection = await prisma.auditSection.create({
      data: {
        auditId,
        title: section.title,
        sortOrder: section.sortOrder,
        maxScore: 5,
      },
    });
    await prisma.auditItemResult.createMany({
      data: section.items.map((item) => ({
        auditId,
        sectionId: auditSection.id,
        itemId: item.id,
      })),
    });
  }
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const audit = await prisma.audit.findUnique({
    where: { id: params.id },
    include: {
      factory: { select: { id: true, name: true, vendorName: true, city: true, country: true } },
      template: { select: { id: true, name: true, code: true } },
      auditor: { select: { id: true, name: true } },
      sections: {
        orderBy: { sortOrder: 'asc' },
        include: {
          items: {
            orderBy: { item: { sortOrder: 'asc' } },
            include: {
              item: true,
              photos: true,
              cap: true,
            },
          },
        },
      },
      photos: { orderBy: { createdAt: 'desc' } },
      gpsLogs: { orderBy: { loggedAt: 'desc' }, take: 1 },
    },
  });

  if (!audit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session.user.role !== 'ADMIN' && audit.auditorId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ audit });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const audit = await prisma.audit.findUnique({ where: { id: params.id }, select: { id: true, status: true, auditorId: true, totalDuration: true, lastResumedAt: true, startTime: true } });
  if (!audit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session.user.role !== 'ADMIN' && audit.auditorId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { status, notes, scheduledAt, auditorId } = parsed.data;
  const updateData: any = {};
  if (notes !== undefined) updateData.notes = notes;
  if (scheduledAt !== undefined) updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
  if (auditorId !== undefined) updateData.auditorId = auditorId;

  if (status && status !== audit.status) {
    const now = new Date();
    updateData.status = status;

    if (status === AuditStatus.IN_PROGRESS) {
      await ensureAuditSections(params.id);
      updateData.lastResumedAt = now;
      if (!audit.startTime) updateData.startTime = now;
    } else if ((status === AuditStatus.PAUSED || status === AuditStatus.DRAFT) && audit.lastResumedAt) {
      const extra = Math.floor((now.getTime() - new Date(audit.lastResumedAt).getTime()) / 1000);
      updateData.totalDuration = audit.totalDuration + Math.max(0, extra);
      updateData.lastResumedAt = null;
    }
  }

  const updated = await prisma.audit.update({ where: { id: params.id }, data: updateData });
  await recordChange('Audit', updated.id, 'UPDATE', { status, notes, scheduledAt, auditorId }, session.user.id);
  return NextResponse.json({ audit: updated });
}
