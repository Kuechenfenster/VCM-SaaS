import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AuditStatus } from '@prisma/client';
import { z } from 'zod';

const gpsSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  accuracy: z.number().optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const audit = await prisma.audit.findUnique({ where: { id: params.id }, select: { status: true, auditorId: true } });
  if (!audit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session.user.role !== 'ADMIN' && audit.auditorId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (audit.status !== AuditStatus.IN_PROGRESS) {
    return NextResponse.json({ error: 'Audit not in progress' }, { status: 409 });
  }

  const body = await req.json();
  const parsed = gpsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const log = await prisma.gPSLog.create({
    data: { auditId: params.id, ...parsed.data },
  });

  return NextResponse.json({ log });
}
