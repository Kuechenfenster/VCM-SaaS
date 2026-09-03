import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deleteFile } from '@/lib/s3';
import { z } from 'zod';

const patchSchema = z.object({
  caption: z.string().optional().nullable(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const photo = await prisma.photo.findUnique({ where: { id: params.id }, include: { audit: { select: { auditorId: true } } } });
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session.user.role !== 'ADMIN' && photo.audit.auditorId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.photo.update({ where: { id: params.id }, data: { caption: parsed.data.caption } });
  return NextResponse.json({ photo: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const photo = await prisma.photo.findUnique({ where: { id: params.id }, include: { audit: { select: { auditorId: true } } } });
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session.user.role !== 'ADMIN' && photo.audit.auditorId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await deleteFile(photo.cloudStoragePath);
  } catch (err) {
    console.error('Failed to delete file from storage', err);
  }

  await prisma.photo.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
