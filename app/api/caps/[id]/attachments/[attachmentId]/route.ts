import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deleteFile } from '@/lib/s3';
import { recordChange } from '@/lib/history';

export async function DELETE(_req: Request, { params }: { params: { id: string; attachmentId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const attachment = await prisma.cAPAttachment.findUnique({
    where: { id: params.attachmentId },
    include: { cap: { include: { audit: { select: { auditorId: true } } } } },
  });
  if (!attachment || attachment.capId !== params.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session.user.role !== 'ADMIN' && attachment.cap.audit.auditorId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await deleteFile(attachment.cloudStoragePath);
  } catch (err) {
    console.error('Failed to delete attachment from storage', err);
  }

  await prisma.cAPAttachment.delete({ where: { id: params.attachmentId } });
  await recordChange('CAPAttachment', params.attachmentId, 'DELETE', { capId: params.id }, session.user.id);
  return NextResponse.json({ success: true });
}
