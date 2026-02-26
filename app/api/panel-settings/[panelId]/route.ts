import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/index';
import { panelSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

type Params = { params: Promise<{ panelId: string }> };

const panelSettingsSchema = z.record(z.string(), z.unknown());

// GET /api/panel-settings/[panelId]
export async function GET(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    const { panelId } = await params;
    const row = db
      .select()
      .from(panelSettings)
      .where(eq(panelSettings.panel_id, panelId))
      .get();

    return NextResponse.json({
      panel_id: panelId,
      settings: row ? JSON.parse(row.settings) as Record<string, unknown> : {},
    });
  } catch (err) {
    console.error('[GET /api/panel-settings/:id]', err);
    return NextResponse.json({ error: 'Failed to fetch panel settings' }, { status: 500 });
  }
}

// PUT /api/panel-settings/[panelId]
// Body: Record<string, unknown>
export async function PUT(req: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    const { panelId } = await params;
    const body = await req.json() as unknown;
    const parsed = panelSettingsSchema.parse(body);

    const row = {
      panel_id: panelId,
      settings: JSON.stringify(parsed),
      updated_at: new Date(),
    };

    db.insert(panelSettings)
      .values(row)
      .onConflictDoUpdate({ target: panelSettings.panel_id, set: row })
      .run();

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid panel settings payload' }, { status: 400 });
    }
    console.error('[PUT /api/panel-settings/:id]', err);
    return NextResponse.json({ error: 'Failed to save panel settings' }, { status: 500 });
  }
}
