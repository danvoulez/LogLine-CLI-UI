import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/index';
import { ensureDbSchema } from '@/db/bootstrap';
import { tabMeta, panels } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { AccessDeniedError, requireAccess } from '@/lib/auth/access';

type Params = { params: Promise<{ panelId: string }> };

// GET /api/tab-meta/[panelId]
export async function GET(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    await ensureDbSchema();
    const access = await requireAccess(_req, 'read');
    const workspaceId = access.workspaceId;
    const appId = access.appId;
    const { panelId } = await params;
    const panel = await db
      .select({ panel_id: panels.panel_id })
      .from(panels)
      .where(and(eq(panels.panel_id, panelId), eq(panels.workspace_id, workspaceId), eq(panels.app_id, appId)))
      .limit(1);
    if (panel.length === 0) return NextResponse.json(null);

    const rows = await db
      .select()
      .from(tabMeta)
      .where(eq(tabMeta.panel_id, panelId))
      .limit(1);
    const row = rows[0];
    return NextResponse.json(row ?? null);
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[GET /api/tab-meta/:id]', err);
    return NextResponse.json({ error: 'Failed to fetch tab meta' }, { status: 500 });
  }
}

// PUT /api/tab-meta/[panelId] — upsert
// Body: { icon?: string; label?: string; shortcut?: number }
export async function PUT(req: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    await ensureDbSchema();
    const access = await requireAccess(req, 'write');
    const workspaceId = access.workspaceId;
    const appId = access.appId;
    const { panelId } = await params;
    const panel = await db
      .select({ panel_id: panels.panel_id })
      .from(panels)
      .where(and(eq(panels.panel_id, panelId), eq(panels.workspace_id, workspaceId), eq(panels.app_id, appId)))
      .limit(1);
    if (panel.length === 0) {
      return NextResponse.json({ error: 'Panel not found in workspace' }, { status: 404 });
    }

    const body = await req.json() as { icon?: string; label?: string; shortcut?: number };

    const row = {
      panel_id: panelId,
      icon:     body.icon     ?? null,
      label:    body.label    ?? null,
      shortcut: body.shortcut ?? null,
    };

    await db.insert(tabMeta)
      .values(row)
      .onConflictDoUpdate({ target: tabMeta.panel_id, set: row });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[PUT /api/tab-meta/:id]', err);
    return NextResponse.json({ error: 'Failed to save tab meta' }, { status: 500 });
  }
}
