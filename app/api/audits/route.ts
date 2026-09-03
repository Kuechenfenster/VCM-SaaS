import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { recordChange } from '@/lib/history';

const auditSchema = z.object({
  factoryId: z.string().min(1),
  templateId: z.string().min(1),
  auditorId: z.string().min(1),
  scheduledAt: z.string().datetime().optional(),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const search = searchParams.get('search') || '';

  const where: any = session.user.role === 'ADMIN' ? {} : { auditorId: session.user.id };
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { factory: { name: { contains: search, mode: 'insensitive' } } },
      { template: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const audits = await prisma.audit.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: {
      factory: { select: { name: true } },
      template: { select: { name: true } },
      auditor: { select: { name: true } },
      _count: { select: { caps: true, itemResults: true } },
    },
  });

  return NextResponse.json({ audits });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.active || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = auditSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { factoryId, templateId, auditorId, scheduledAt } = parsed.data;
  const audit = await prisma.audit.create({
    data: {
      factoryId,
      templateId,
      auditorId,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
    },
  });

  await recordChange('Audit', audit.id, 'CREATE', parsed.data, session.user.id);
  return NextResponse.json({ audit });
}
