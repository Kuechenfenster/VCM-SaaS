import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { recordChange } from '@/lib/history';
import { z } from 'zod';

const updateSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']).optional(),
  correctiveAction: z.string().optional().nullable(),
  finding: z.string().optional().nullable(),
  targetDate: z.string().datetime().optional().nullable(),
  planDate: z.string().datetime().optional().nullable(),
  actionDate: z.string().datetime().optional().nullable(),
  verifiedBy: z.string().optional().nullable(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cap = await prisma.cAP.findUnique({
    where: { id: params.id },
    include: {
      audit: {
        select: {
          id: true,
          status: true,
          factory: { select: { id: true, name: true } },
          template: { select: { name: true } },
          auditorId: true,
          auditor: { select: { name: true } },
        },
      },
      itemResult: { include: { item: true } },
      attachments: true,
    },
  });

  if (!cap) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session.user.role !== 'ADMIN' && cap.audit.auditorId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ cap });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cap = await prisma.cAP.findUnique({ where: { id: params.id }, include: { audit: { select: { auditorId: true } } } });
  if (!cap) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session.user.role !== 'ADMIN' && cap.audit.auditorId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updateData: any = {};
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (parsed.data.correctiveAction !== undefined) updateData.correctiveAction = parsed.data.correctiveAction;
  if (parsed.data.finding !== undefined) updateData.finding = parsed.data.finding;
  if (parsed.data.targetDate !== undefined) updateData.targetDate = parsed.data.targetDate ? new Date(parsed.data.targetDate) : null;
  if (parsed.data.planDate !== undefined) updateData.planDate = parsed.data.planDate ? new Date(parsed.data.planDate) : null;
  if (parsed.data.actionDate !== undefined) updateData.actionDate = parsed.data.actionDate ? new Date(parsed.data.actionDate) : null;
  if (parsed.data.verifiedBy !== undefined) updateData.verifiedBy = parsed.data.verifiedBy;

  const updated = await prisma.cAP.update({ where: { id: params.id }, data: updateData });
  await recordChange('CAP', updated.id, 'UPDATE', updateData, session.user.id);
  return NextResponse.json({ cap: updated });
}
