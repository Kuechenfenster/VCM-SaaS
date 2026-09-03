import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ItemResult } from '@prisma/client';
import { z } from 'zod';

const itemUpdateSchema = z.object({
  itemResultId: z.string().min(1),
  result: z.enum(['PASS', 'FAIL', 'NA']).optional().nullable(),
  score: z.number().min(0).max(100).optional().nullable(),
  findings: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  requiresCap: z.boolean().optional(),
});

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const audit = await prisma.audit.findUnique({ where: { id: params.id }, select: { status: true, auditorId: true } });
  if (!audit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session.user.role !== 'ADMIN' && audit.auditorId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = itemUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { itemResultId, result, score, findings, remarks, requiresCap } = parsed.data;

  const existing = await prisma.auditItemResult.findUnique({
    where: { id: itemResultId },
    include: { item: true, cap: true },
  });
  if (!existing || existing.auditId !== params.id) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  const updateData: any = {};
  if (result !== undefined) updateData.result = result;
  if (score !== undefined) updateData.score = score;
  if (findings !== undefined) updateData.findings = findings;
  if (remarks !== undefined) updateData.remarks = remarks;
  if (requiresCap !== undefined) updateData.requiresCap = requiresCap;

  const updated = await prisma.auditItemResult.update({
    where: { id: itemResultId },
    data: updateData,
    include: { item: true, cap: true, photos: true },
  });

  if (requiresCap && result === ItemResult.FAIL && !existing.cap) {
    await prisma.cAP.create({
      data: {
        auditId: params.id,
        itemResultId,
        finding: findings || `Finding: ${existing.item.text}`,
      },
    });
  }

  if ((result === ItemResult.PASS || result === ItemResult.NA) && existing.cap) {
    await prisma.cAP.deleteMany({ where: { itemResultId } });
  }

  return NextResponse.json({ itemResult: updated });
}
