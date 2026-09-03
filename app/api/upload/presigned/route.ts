import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getUploadPresignedUrl } from '@/lib/s3';
import { z } from 'zod';

const schema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const key = `uploads/${Date.now()}-${parsed.data.fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
  const { url } = await getUploadPresignedUrl(key, parsed.data.contentType);
  return NextResponse.json({ url, key });
}
