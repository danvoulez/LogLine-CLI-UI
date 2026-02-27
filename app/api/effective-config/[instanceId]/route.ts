import { NextRequest, NextResponse } from 'next/server';
import { resolveEffectiveConfig } from '@/lib/config/effective-config';
import { ensureDbSchema } from '@/db/bootstrap';
import { AccessDeniedError, requireAccess } from '@/lib/auth/access';

type Params = { params: Promise<{ instanceId: string }> };

// GET /api/effective-config/[instanceId]
export async function GET(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    await ensureDbSchema();
    const access = await requireAccess(_req, 'private_read');
    const workspaceId = access.workspaceId;
    const appId = access.appId;
    const { instanceId } = await params;
    const resolved = await resolveEffectiveConfig(instanceId, workspaceId, appId);
    if (!resolved) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }
    return NextResponse.json(resolved);
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[GET /api/effective-config/:id]', err);
    return NextResponse.json({ error: 'Failed to resolve effective config' }, { status: 500 });
  }
}
