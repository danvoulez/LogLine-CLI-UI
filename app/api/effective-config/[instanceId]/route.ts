import { NextRequest, NextResponse } from 'next/server';
import { resolveEffectiveConfig } from '@/lib/config/effective-config';
import { ensureDbSchema } from '@/db/bootstrap';

type Params = { params: Promise<{ instanceId: string }> };

// GET /api/effective-config/[instanceId]
export async function GET(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    await ensureDbSchema();
    const { instanceId } = await params;
    const resolved = await resolveEffectiveConfig(instanceId);
    if (!resolved) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }
    return NextResponse.json(resolved);
  } catch (err) {
    console.error('[GET /api/effective-config/:id]', err);
    return NextResponse.json({ error: 'Failed to resolve effective config' }, { status: 500 });
  }
}
