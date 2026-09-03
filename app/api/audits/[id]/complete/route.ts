import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { recordChange } from '@/lib/history';
import { AuditStatus } from '@prisma/client';
import { calculateSectionScore, calculateOverallScore } from '@/lib/utils';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const audit = await prisma.audit.findUnique({
    where: { id: params.id },
    include: {
      sections: { include: { items: { include: { item: true } } } },
    },
  });
  if (!audit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session.user.role !== 'ADMIN' && audit.auditorId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const now = new Date();
  let totalDuration = audit.totalDuration;
  if (audit.lastResumedAt) {
    totalDuration += Math.floor((now.getTime() - new Date(audit.lastResumedAt).getTime()) / 1000);
  }

  // Compute section scores
  for (const section of audit.sections) {
    const score = calculateSectionScore(
      section.items.map((item) => ({
        score: item.score,
        maxScore: item.item.maxScore,
        result: item.result,
      }))
    );
    await prisma.auditSection.update({
      where: { id: section.id },
      data: { score },
    });
  }

  const refreshed = await prisma.audit.findUnique({
    where: { id: params.id },
    include: {
      sections: { include: { items: { include: { item: true } } } },
    },
  });

  const overallScore = refreshed
    ? calculateOverallScore(
        refreshed.sections.map((s) => ({
          score: s.score,
          maxScore: s.maxScore,
          items: s.items.map((i) => ({
            score: i.score,
            maxScore: i.item.maxScore,
            result: i.result,
          })),
        }))
      )
    : null;

  const completed = await prisma.audit.update({
    where: { id: params.id },
    data: {
      status: AuditStatus.COMPLETED,
      endTime: now,
      totalDuration,
      lastResumedAt: null,
      overallScore,
    },
  });

  await recordChange('Audit', completed.id, 'COMPLETE', { overallScore, totalDuration }, session.user.id);
  return NextResponse.json({ audit: completed });
}
