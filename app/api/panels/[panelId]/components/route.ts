import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/index';
import { panelComponents } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { MOCK_COMPONENTS } from '@/mocks/ublx-mocks';
import { z } from 'zod';
import {
  findFirstAvailablePlacement,
  normalizeRectToPresets,
  resolveAllowedPresetIds,
  resolveDefaultPresetId,
} from '@/lib/layout/grid-presets';

type Params = { params: Promise<{ panelId: string }> };
const addComponentSchema = z.object({
  componentId: z.string().min(1),
});

// GET /api/panels/[panelId]/components
export async function GET(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    const { panelId } = await params;
    const rows = db
      .select()
      .from(panelComponents)
      .where(eq(panelComponents.panel_id, panelId))
      .orderBy(asc(panelComponents.position))
      .all();

    const result = rows.map((c) => {
      const def = MOCK_COMPONENTS.find((m) => m.component_id === c.component_id);
      const allowed = resolveAllowedPresetIds(def);
      const normalized = normalizeRectToPresets(
        { x: c.rect_x, y: c.rect_y, w: c.rect_w, h: c.rect_h },
        allowed,
        { cols: 32, rows: 24 }
      );

      return {
        instance_id:  c.instance_id,
        component_id: c.component_id,
        version:      c.version,
        rect: normalized.rect,
        front_props: JSON.parse(c.front_props) as Record<string, unknown>,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/panels/:id/components]', err);
    return NextResponse.json({ error: 'Failed to fetch components' }, { status: 500 });
  }
}

// POST /api/panels/[panelId]/components
// Body: { componentId: string }
export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    const { panelId } = await params;
    const body = addComponentSchema.parse(await req.json());
    const def = MOCK_COMPONENTS.find((c) => c.component_id === body.componentId);

    if (!def) {
      return NextResponse.json({ error: 'Unknown componentId' }, { status: 400 });
    }

    const existing = db
      .select()
      .from(panelComponents)
      .where(eq(panelComponents.panel_id, panelId))
      .all();

    const allowed = resolveAllowedPresetIds(def);
    const defaultPreset = resolveDefaultPresetId(def);
    const placement = findFirstAvailablePlacement(
      existing.map((c) => ({ x: c.rect_x, y: c.rect_y, w: c.rect_w, h: c.rect_h })),
      defaultPreset,
      { cols: 32, rows: 24 }
    );

    if (!placement) {
      return NextResponse.json(
        { error: 'No space available in this panel for selected component size' },
        { status: 409 }
      );
    }

    const newComp = {
      instance_id:  `${body.componentId}-${crypto.randomUUID()}`,
      panel_id:     panelId,
      component_id: body.componentId,
      version:      def?.version ?? '1.0.0',
      rect_x:       placement.x,
      rect_y:       placement.y,
      rect_w:       placement.w,
      rect_h:       placement.h,
      front_props:  JSON.stringify({
        size_preset: defaultPreset,
        allowed_size_presets: allowed,
      }),
      position:     existing.length,
      created_at:   new Date(),
      updated_at:   new Date(),
    };

    db.insert(panelComponents).values(newComp).run();

    return NextResponse.json({
      instance_id:  newComp.instance_id,
      component_id: newComp.component_id,
      version:      newComp.version,
      rect: { x: newComp.rect_x, y: newComp.rect_y, w: newComp.rect_w, h: newComp.rect_h },
      front_props: JSON.parse(newComp.front_props) as Record<string, unknown>,
    }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
    }
    console.error('[POST /api/panels/:id/components]', err);
    return NextResponse.json({ error: 'Failed to add component' }, { status: 500 });
  }
}
