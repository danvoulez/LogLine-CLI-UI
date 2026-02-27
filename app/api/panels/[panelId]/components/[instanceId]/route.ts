import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/index';
import { ensureDbSchema } from '@/db/bootstrap';
import { panelComponents, panels } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { MOCK_COMPONENTS } from '@/mocks/ublx-mocks';
import { normalizeRectToPresets, resolveAllowedPresetIds, SizePresetId } from '@/lib/layout/grid-presets';
import { z } from 'zod';
import { AccessDeniedError, requireAccess } from '@/lib/auth/access';
import { isCliCommandAllowed, isAllowedConnectionType, normalizeTemplateFrontProps } from '@/lib/config/component-template';

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
    await ensureDbSchema();
    const access = await requireAccess(req, 'write');
    const workspaceId = access.workspaceId;
    const appId = access.appId;
    const { panelId, instanceId } = await params;
    const panel = await db
      .select({ panel_id: panels.panel_id })
      .from(panels)
      .where(and(eq(panels.panel_id, panelId), eq(panels.workspace_id, workspaceId), eq(panels.app_id, appId)))
      .limit(1);
    if (panel.length === 0) {
      return NextResponse.json({ error: 'Panel not found in workspace' }, { status: 404 });
    }

    const body = patchComponentSchema.parse(await req.json());

    const rows = await db
      .select()
      .from(panelComponents)
      .where(and(eq(panelComponents.instance_id, instanceId), eq(panelComponents.panel_id, panelId)))
      .limit(1);
    const current = rows[0];

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
      const normalizedFrontProps = normalizeTemplateFrontProps(current.component_id, body.front_props);
      const cliCommand = typeof normalizedFrontProps.cli_command === 'string' ? normalizedFrontProps.cli_command : '';
      const connectionType =
        typeof normalizedFrontProps.connection_type === 'string' ? normalizedFrontProps.connection_type : '';

      if (!isCliCommandAllowed(cliCommand)) {
        return NextResponse.json({ error: 'cli_command is not allowed by template policy' }, { status: 400 });
      }
      if (!isAllowedConnectionType(connectionType)) {
        return NextResponse.json({ error: 'connection_type is not allowed by template policy' }, { status: 400 });
      }

      updates.front_props = JSON.stringify(normalizedFrontProps);
    }

    await db.update(panelComponents)
      .set(updates)
      .where(eq(panelComponents.instance_id, instanceId));

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
    }
    if (err instanceof AccessDeniedError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[PATCH /api/panels/:id/components/:iid]', err);
    return NextResponse.json({ error: 'Failed to update component' }, { status: 500 });
  }
}

// DELETE /api/panels/[panelId]/components/[instanceId]
// Also cascades to instance_configs via FK
export async function DELETE(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    await ensureDbSchema();
    const access = await requireAccess(_req, 'write');
    const workspaceId = access.workspaceId;
    const appId = access.appId;
    const { panelId, instanceId } = await params;
    const panel = await db
      .select({ panel_id: panels.panel_id })
      .from(panels)
      .where(and(eq(panels.panel_id, panelId), eq(panels.workspace_id, workspaceId), eq(panels.app_id, appId)))
      .limit(1);
    if (panel.length === 0) {
      return NextResponse.json({ error: 'Panel not found in workspace' }, { status: 404 });
    }

    await db
      .delete(panelComponents)
      .where(and(eq(panelComponents.instance_id, instanceId), eq(panelComponents.panel_id, panelId)));
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[DELETE /api/panels/:id/components/:iid]', err);
    return NextResponse.json({ error: 'Failed to remove component' }, { status: 500 });
  }
}
