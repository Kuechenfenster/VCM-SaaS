import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { recordChange } from '@/lib/history';
import { z } from 'zod';

const factorySchema = z.object({
  name: z.string().min(1),
  vendorName: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const factories = await prisma.factory.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { audits: true } } },
  });

  return NextResponse.json({ factories });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.active || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = factorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const factory = await prisma.factory.create({ data: parsed.data });
  await recordChange('Factory', factory.id, 'CREATE', parsed.data, session.user.id);

  return NextResponse.json({ factory });
}
