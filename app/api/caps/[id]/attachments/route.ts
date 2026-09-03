import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { recordChange } from '@/lib/history';
import { z } from 'zod';

const schema = z.object({
  cloudStoragePath: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().optional(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cap = await prisma.cAP.findUnique({ where: { id: params.id }, include: { audit: { select: { auditorId: true } } } });
  if (!cap) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session.user.role !== 'ADMIN' && cap.audit.auditorId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const attachments = await prisma.cAPAttachment.findMany({ where: { capId: params.id }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ attachments });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cap = await prisma.cAP.findUnique({ where: { id: params.id }, include: { audit: { select: { auditorId: true } } } });
  if (!cap) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session.user.role !== 'ADMIN' && cap.audit.auditorId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const attachment = await prisma.cAPAttachment.create({
    data: { capId: params.id, ...parsed.data },
  });

  await recordChange('CAPAttachment', attachment.id, 'CREATE', { capId: params.id, fileName: attachment.fileName }, session.user.id);
  return NextResponse.json({ attachment });
}
