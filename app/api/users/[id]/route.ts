import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { recordChange } from '@/lib/history';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const patchSchema = z.object({
  password: z.string().min(6).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.active || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updateData: any = {};
  const changes: Record<string, unknown> = {};
  if (parsed.data.password) {
    updateData.password = await bcrypt.hash(parsed.data.password, 10);
    changes.passwordReset = true;
  }
  if (parsed.data.active !== undefined) {
    updateData.active = parsed.data.active;
    changes.active = parsed.data.active;
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data: updateData,
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });

  await recordChange('User', user.id, 'UPDATE', changes, session.user.id);
  return NextResponse.json({ user });
}
