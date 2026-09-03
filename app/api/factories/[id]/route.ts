import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { recordChange } from '@/lib/history';
import { z } from 'zod';

const factorySchema = z.object({
  name: z.string().min(1),
  vendorName: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const factory = await prisma.factory.findUnique({
    where: { id: params.id },
    include: {
      audits: {
        orderBy: { scheduledAt: 'desc' },
        take: 10,
        select: { id: true, status: true, scheduledAt: true, overallScore: true },
      },
      _count: { select: { audits: true } },
    },
  });

  if (!factory) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ factory });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.active || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = factorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.factory.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const factory = await prisma.factory.update({ where: { id: params.id }, data: parsed.data });
  await recordChange('Factory', factory.id, 'UPDATE', parsed.data, session.user.id);

  return NextResponse.json({ factory });
}
