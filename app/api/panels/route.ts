import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/index';
import { panels, panelComponents } from '@/db/schema';
import { seedDefaultData } from '@/db/seed';
import { asc } from 'drizzle-orm';
import { MOCK_COMPONENTS } from '@/mocks/ublx-mocks';
import { normalizeRectToPresets, resolveAllowedPresetIds } from '@/lib/layout/grid-presets';
import { z } from 'zod';

const createPanelSchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
});

// GET /api/panels
// Returns all panels ordered by position, each with their components array.
// Seeds the database on first call if tables are empty.
export async function GET(): Promise<NextResponse> {
  try {
    const count = db.select().from(panels).all().length;
    if (count === 0) seedDefaultData();

    const allPanels = db
      .select()
      .from(panels)
      .orderBy(asc(panels.position))
      .all();

    const allComponents = db
      .select()
      .from(panelComponents)
      .orderBy(asc(panelComponents.position))
      .all();

    // Group components by panel_id in JS
    const componentsByPanel = allComponents.reduce<Record<string, typeof allComponents>>(
      (acc, comp) => {
        if (!acc[comp.panel_id]) acc[comp.panel_id] = [];
        acc[comp.panel_id].push(comp);
        return acc;
      },
      {}
    );

    const result = allPanels.map((p) => ({
      panel_id:    p.panel_id,
      name:        p.name,
      position:    p.position,
      version:     p.version,
      layout_grid: { rows: 24, cols: 32 },
      components: (componentsByPanel[p.panel_id] ?? []).map((c) => ({
        ...(function () {
          const def = MOCK_COMPONENTS.find((m) => m.component_id === c.component_id);
          const normalized = normalizeRectToPresets(
            { x: c.rect_x, y: c.rect_y, w: c.rect_w, h: c.rect_h },
            resolveAllowedPresetIds(def),
            { cols: 32, rows: 24 }
          );
          return {
            rect: normalized.rect,
          };
        })(),
        instance_id:  c.instance_id,
        component_id: c.component_id,
        version:      c.version,
        front_props: JSON.parse(c.front_props) as Record<string, unknown>,
      })),
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/panels]', err);
    return NextResponse.json({ error: 'Failed to fetch panels' }, { status: 500 });
  }
}

// POST /api/panels
// Body: { name: string }
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = createPanelSchema.parse(await req.json());
    const name = body.name ?? 'New Tab';

    const allPanels = db.select().from(panels).all();
    const maxPosition = allPanels.reduce((max, p) => Math.max(max, p.position), -1);

    const newPanel = {
      panel_id:   crypto.randomUUID(),
      name,
      position:   maxPosition + 1,
      version:    '1.0.0',
      created_at: new Date(),
      updated_at: new Date(),
    };

    db.insert(panels).values(newPanel).run();

    return NextResponse.json(newPanel, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid panel payload' }, { status: 400 });
    }
    console.error('[POST /api/panels]', err);
    return NextResponse.json({ error: 'Failed to create panel' }, { status: 500 });
  }
}
