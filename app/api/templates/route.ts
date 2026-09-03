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

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const templates = await prisma.auditTemplate.findMany({
    orderBy: { name: 'asc' },
    include: {
      sections: {
        orderBy: { sortOrder: 'asc' },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      },
      _count: { select: { audits: true } },
    },
  });

  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.active || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = templateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.auditTemplate.findUnique({ where: { code: parsed.data.code } });
  if (existing) return NextResponse.json({ error: 'Template code already exists' }, { status: 409 });

  const template = await prisma.auditTemplate.create({
    data: {
      code: parsed.data.code,
      name: parsed.data.name,
      description: parsed.data.description,
      sections: {
        create: parsed.data.sections.map((section) => ({
          title: section.title,
          sortOrder: section.sortOrder,
          items: {
            create: section.items.map((item) => ({
              text: item.text,
              maxScore: item.maxScore,
              sortOrder: item.sortOrder,
            })),
          },
        })),
      },
    },
    include: { sections: { include: { items: true } } },
  });

  await recordChange('AuditTemplate', template.id, 'CREATE', { code: template.code }, session.user.id);
  return NextResponse.json({ template });
}
