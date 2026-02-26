import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/index';
import { ensureDbSchema } from '@/db/bootstrap';
import { panels } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { resolveWorkspaceId } from '@/lib/auth/workspace';

type Params = { params: Promise<{ panelId: string }> };

// PATCH /api/panels/[panelId]
// Body: { name?: string; position?: number }
export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    await ensureDbSchema();
    const workspaceId = resolveWorkspaceId(req);
    const { panelId } = await params;
    const body = await req.json() as { name?: string; position?: number };

    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (body.name     !== undefined) updates.name     = body.name.trim();
    if (body.position !== undefined) updates.position = body.position;

    await db
      .update(panels)
      .set(updates)
      .where(and(eq(panels.panel_id, panelId), eq(panels.workspace_id, workspaceId)));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[PATCH /api/panels/:id]', err);
    return NextResponse.json({ error: 'Failed to update panel' }, { status: 500 });
  }
}

// DELETE /api/panels/[panelId]
// CASCADE removes panel_components and tab_meta automatically
export async function DELETE(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    await ensureDbSchema();
    const workspaceId = resolveWorkspaceId(_req);
    const { panelId } = await params;
    await db
      .delete(panels)
      .where(and(eq(panels.panel_id, panelId), eq(panels.workspace_id, workspaceId)));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/panels/:id]', err);
    return NextResponse.json({ error: 'Failed to delete panel' }, { status: 500 });
  }
}
