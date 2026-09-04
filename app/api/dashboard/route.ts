import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getDashboardData } from '@/lib/dashboard';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.active) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await getDashboardData({ id: session.user.id, role: session.user.role });
  return NextResponse.json(data);
}
