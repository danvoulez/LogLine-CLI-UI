import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/index';
import { ensureDbSchema } from '@/db/bootstrap';
import { tabMeta } from '@/db/schema';
import { eq } from 'drizzle-orm';

type Params = { params: Promise<{ panelId: string }> };

// GET /api/tab-meta/[panelId]
export async function GET(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    await ensureDbSchema();
    const { panelId } = await params;
    const rows = await db
      .select()
      .from(tabMeta)
      .where(eq(tabMeta.panel_id, panelId))
      .limit(1);
    const row = rows[0];
    return NextResponse.json(row ?? null);
  } catch (err) {
    console.error('[GET /api/tab-meta/:id]', err);
    return NextResponse.json({ error: 'Failed to fetch tab meta' }, { status: 500 });
  }
}

// PUT /api/tab-meta/[panelId] — upsert
// Body: { icon?: string; label?: string; shortcut?: number }
export async function PUT(req: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    await ensureDbSchema();
    const { panelId } = await params;
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
    console.error('[PUT /api/tab-meta/:id]', err);
    return NextResponse.json({ error: 'Failed to save tab meta' }, { status: 500 });
  }
}
