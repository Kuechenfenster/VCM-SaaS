import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { CAPStatus } from '@prisma/client';

const querySchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']).optional(),
  sortBy: z.enum(['targetDate', 'createdAt', 'status']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    status: searchParams.get('status') || undefined,
    sortBy: searchParams.get('sortBy') || 'createdAt',
    sortOrder: searchParams.get('sortOrder') || 'desc',
  });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const where: any = session.user.role === 'ADMIN' ? {} : { audit: { auditorId: session.user.id } };
  if (parsed.data.status) where.status = parsed.data.status;

  const orderBy: any = {};
  if (parsed.data.sortBy === 'status') orderBy.status = parsed.data.sortOrder;
  else if (parsed.data.sortBy === 'targetDate') orderBy.targetDate = parsed.data.sortOrder;
  else orderBy.createdAt = parsed.data.sortOrder;

  const [caps, open, inProgress, resolved] = await Promise.all([
    prisma.cAP.findMany({
      where,
      orderBy,
      include: {
        audit: {
          select: {
            id: true,
            factory: { select: { name: true } },
            template: { select: { name: true } },
            auditor: { select: { name: true } },
          },
        },
        itemResult: { select: { item: { select: { text: true } } } },
        _count: { select: { attachments: true } },
      },
    }),
    prisma.cAP.count({ where: { ...where, status: CAPStatus.OPEN } }),
    prisma.cAP.count({ where: { ...where, status: CAPStatus.IN_PROGRESS } }),
    prisma.cAP.count({ where: { ...where, status: CAPStatus.RESOLVED } }),
  ]);

  return NextResponse.json({ caps, stats: { open, inProgress, resolved, total: open + inProgress + resolved } });
}
