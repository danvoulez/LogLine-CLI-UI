import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/index';
import { panelComponents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { MOCK_COMPONENTS } from '@/mocks/ublx-mocks';
import { normalizeRectToPresets, resolveAllowedPresetIds, SizePresetId } from '@/lib/layout/grid-presets';
import { z } from 'zod';

type Params = { params: Promise<{ panelId: string; instanceId: string }> };
const patchComponentSchema = z.object({
  rect: z.object({
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    w: z.number().int().min(1),
    h: z.number().int().min(1),
  }).optional(),
  front_props: z.record(z.string(), z.unknown()).optional(),
});

// PATCH /api/panels/[panelId]/components/[instanceId]
// Body: { rect?: { x, y, w, h }; front_props?: Record<string, unknown> }
export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    const { instanceId } = await params;
    const body = patchComponentSchema.parse(await req.json());

    const current = db
      .select()
      .from(panelComponents)
      .where(eq(panelComponents.instance_id, instanceId))
      .get();

    if (!current) {
      return NextResponse.json({ error: 'Component instance not found' }, { status: 404 });
    }

    const def = MOCK_COMPONENTS.find((m) => m.component_id === current.component_id);
    const allowed = resolveAllowedPresetIds(def);
    const preferredPreset = (
      body.front_props && typeof body.front_props.size_preset === 'string'
        ? body.front_props.size_preset
        : undefined
    ) as SizePresetId | undefined;

    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (body.rect) {
      const normalized = normalizeRectToPresets(
        body.rect,
        allowed,
        { cols: 32, rows: 24 },
        preferredPreset
      );
      updates.rect_x = normalized.rect.x;
      updates.rect_y = normalized.rect.y;
      updates.rect_w = normalized.rect.w;
      updates.rect_h = normalized.rect.h;
    }
    if (body.front_props !== undefined) {
      updates.front_props = JSON.stringify(body.front_props);
    }

    db.update(panelComponents)
      .set(updates)
      .where(eq(panelComponents.instance_id, instanceId))
      .run();

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
    }
    console.error('[PATCH /api/panels/:id/components/:iid]', err);
    return NextResponse.json({ error: 'Failed to update component' }, { status: 500 });
  }
}

// DELETE /api/panels/[panelId]/components/[instanceId]
// Also cascades to instance_configs via FK
export async function DELETE(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    const { instanceId } = await params;
    db.delete(panelComponents)
      .where(eq(panelComponents.instance_id, instanceId))
      .run();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/panels/:id/components/:iid]', err);
    return NextResponse.json({ error: 'Failed to remove component' }, { status: 500 });
  }
}
