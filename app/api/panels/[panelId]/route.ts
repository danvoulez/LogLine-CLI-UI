import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/index';
import { panels } from '@/db/schema';
import { eq } from 'drizzle-orm';

type Params = { params: Promise<{ panelId: string }> };

// PATCH /api/panels/[panelId]
// Body: { name?: string; position?: number }
export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    const { panelId } = await params;
    const body = await req.json() as { name?: string; position?: number };

    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (body.name     !== undefined) updates.name     = body.name.trim();
    if (body.position !== undefined) updates.position = body.position;

    db.update(panels).set(updates).where(eq(panels.panel_id, panelId)).run();

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
    const { panelId } = await params;
    db.delete(panels).where(eq(panels.panel_id, panelId)).run();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/panels/:id]', err);
    return NextResponse.json({ error: 'Failed to delete panel' }, { status: 500 });
  }
}
