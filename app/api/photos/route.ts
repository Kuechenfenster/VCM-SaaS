import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { recordChange } from '@/lib/history';
import { z } from 'zod';

const schema = z.object({
  auditId: z.string().min(1),
  itemResultId: z.string().optional().nullable(),
  cloudStoragePath: z.string().min(1),
  caption: z.string().optional().nullable(),
  isPublic: z.boolean().optional(),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const auditId = searchParams.get('auditId');
  const itemResultId = searchParams.get('itemResultId');
  if (!auditId) return NextResponse.json({ error: 'Missing auditId' }, { status: 400 });

  const audit = await prisma.audit.findUnique({ where: { id: auditId }, select: { auditorId: true } });
  if (!audit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session.user.role !== 'ADMIN' && audit.auditorId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const where: any = { auditId };
  if (itemResultId) where.itemResultId = itemResultId;

  const photos = await prisma.photo.findMany({ where, orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ photos });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { auditId, itemResultId, cloudStoragePath, caption, isPublic } = parsed.data;

  const audit = await prisma.audit.findUnique({ where: { id: auditId }, select: { auditorId: true, status: true } });
  if (!audit) return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  if (session.user.role !== 'ADMIN' && audit.auditorId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const photo = await prisma.photo.create({
    data: { auditId, itemResultId, cloudStoragePath, caption, isPublic },
  });

  await recordChange('Photo', photo.id, 'CREATE', { auditId, itemResultId }, session.user.id);
  return NextResponse.json({ photo });
}
