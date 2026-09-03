import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { recordChange } from '@/lib/history';
import { z } from 'zod';

const itemSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1),
  maxScore: z.number().default(5),
  sortOrder: z.number().default(0),
});

const sectionSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  sortOrder: z.number().default(0),
  items: z.array(itemSchema),
});

const templateSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  sections: z.array(sectionSchema),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const template = await prisma.auditTemplate.findUnique({
    where: { id: params.id },
    include: {
      sections: {
        orderBy: { sortOrder: 'asc' },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      },
      _count: { select: { audits: true } },
    },
  });

  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ template });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.active || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = templateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.auditTemplate.findUnique({
    where: { id: params.id },
    include: {
      sections: { include: { items: true } },
      _count: { select: { audits: true } },
    },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (existing.code !== parsed.data.code) {
    const conflict = await prisma.auditTemplate.findUnique({ where: { code: parsed.data.code } });
    if (conflict) return NextResponse.json({ error: 'Template code already exists' }, { status: 409 });
  }

  // Delete removed sections/items then recreate/replace
  const newSectionIds = parsed.data.sections.map((s) => s.id).filter(Boolean) as string[];
  const sectionsToDelete = existing.sections.filter((s) => !newSectionIds.includes(s.id));

  for (const section of sectionsToDelete) {
    await prisma.templateSection.delete({ where: { id: section.id } });
  }

  for (const [sIdx, section] of parsed.data.sections.entries()) {
    const sectionData = {
      title: section.title,
      sortOrder: sIdx,
    };

    let sectionRecord;
    if (section.id) {
      sectionRecord = await prisma.templateSection.update({ where: { id: section.id }, data: sectionData });
      const newItemIds = section.items.map((i) => i.id).filter(Boolean) as string[];
      const existingItems = existing.sections.find((s) => s.id === section.id)?.items || [];
      const itemsToDelete = existingItems.filter((i) => !newItemIds.includes(i.id));
      for (const item of itemsToDelete) {
        await prisma.checklistItem.delete({ where: { id: item.id } });
      }
    } else {
      sectionRecord = await prisma.templateSection.create({
        data: { ...sectionData, templateId: params.id },
      });
    }

    for (const [iIdx, item] of section.items.entries()) {
      const itemData = { text: item.text, maxScore: item.maxScore, sortOrder: iIdx };
      if (item.id && existing.sections.some((s) => s.id === section.id && s.items.some((i) => i.id === item.id))) {
        await prisma.checklistItem.update({ where: { id: item.id }, data: itemData });
      } else {
        await prisma.checklistItem.create({ data: { ...itemData, sectionId: sectionRecord.id } });
      }
    }
  }

  const updated = await prisma.auditTemplate.update({
    where: { id: params.id },
    data: { code: parsed.data.code, name: parsed.data.name, description: parsed.data.description },
    include: { sections: { orderBy: { sortOrder: 'asc' }, include: { items: { orderBy: { sortOrder: 'asc' } } } } },
  });

  await recordChange('AuditTemplate', updated.id, 'UPDATE', { code: updated.code }, session.user.id);
  return NextResponse.json({ template: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.active || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const existing = await prisma.auditTemplate.findUnique({ where: { id: params.id }, include: { _count: { select: { audits: true } } } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing._count.audits > 0) {
    return NextResponse.json({ error: 'Cannot delete template with existing audits' }, { status: 409 });
  }

  await prisma.auditTemplate.delete({ where: { id: params.id } });
  await recordChange('AuditTemplate', params.id, 'DELETE', {}, session.user.id);
  return NextResponse.json({ success: true });
}
