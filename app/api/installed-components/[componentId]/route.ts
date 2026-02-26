import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/index';
import { ensureDbSchema } from '@/db/bootstrap';
import { installedComponents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { resolveWorkspaceId } from '@/lib/auth/workspace';

type Params = { params: Promise<{ componentId: string }> };

// DELETE /api/installed-components/[componentId]
export async function DELETE(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    await ensureDbSchema();
    const workspaceId = resolveWorkspaceId(_req);
    const { componentId } = await params;
    await db
      .delete(installedComponents)
      .where(eq(installedComponents.component_id, `${workspaceId}::${componentId}`));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/installed-components/:id]', err);
    return NextResponse.json({ error: 'Failed to uninstall component' }, { status: 500 });
  }
}
