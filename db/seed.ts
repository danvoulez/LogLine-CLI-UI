import { db } from './index';
import { panels, panelComponents, tabMeta, installedComponents } from './schema';
import { MOCK_PANELS, MOCK_COMPONENTS } from '@/mocks/ublx-mocks';
import {
  normalizeRectToPresets,
  resolveAllowedPresetIds,
  resolveDefaultPresetId,
} from '@/lib/layout/grid-presets';
import { and, eq } from 'drizzle-orm';

const PANEL_ICONS: Record<string, string> = {
  home: 'Home',
  ops: 'Activity',
};

export async function seedDefaultData(workspaceId = 'default', appId = process.env.DEFAULT_APP_ID || 'ublx'): Promise<void> {
  const existing = await db
    .select({ panel_id: panels.panel_id })
    .from(panels)
    .where(and(eq(panels.workspace_id, workspaceId), eq(panels.app_id, appId)))
    .limit(1);
  if (existing.length > 0) return;

  await db.transaction(async (tx) => {
    const panelRows = MOCK_PANELS.map((p, idx) => ({
      panel_id: `${workspaceId}::${p.panel_id}`,
      workspace_id: workspaceId,
      app_id: appId,
      name: p.name,
      position: idx,
      version: p.version,
      created_at: new Date(),
      updated_at: new Date(),
    }));
    await tx.insert(panels).values(panelRows);

    const tabMetaRows = MOCK_PANELS.map((p, idx) => ({
      panel_id: `${workspaceId}::${p.panel_id}`,
      icon: PANEL_ICONS[p.panel_id] ?? 'FileText',
      label: p.name,
      shortcut: idx + 1 <= 9 ? idx + 1 : null,
    }));
    await tx.insert(tabMeta).values(tabMetaRows);

    const componentRows = MOCK_PANELS.flatMap((p) =>
      p.components.map((c, compIdx) => {
        const def = MOCK_COMPONENTS.find((m) => m.component_id === c.component_id);
        const allowed = resolveAllowedPresetIds(def);
        const preset = resolveDefaultPresetId(def);
        const normalized = normalizeRectToPresets(c.rect, allowed, { cols: 32, rows: 24 }, preset);

        return {
          instance_id: `${workspaceId}::${c.instance_id}`,
          panel_id: `${workspaceId}::${p.panel_id}`,
          component_id: c.component_id,
          version: c.version,
          rect_x: normalized.rect.x,
          rect_y: normalized.rect.y,
          rect_w: normalized.rect.w,
          rect_h: normalized.rect.h,
          front_props: JSON.stringify({
            ...(c.front_props ?? {}),
            size_preset: normalized.presetId,
            allowed_size_presets: allowed,
          }),
          position: compIdx,
          created_at: new Date(),
          updated_at: new Date(),
        };
      })
    );

    if (componentRows.length > 0) {
      await tx.insert(panelComponents).values(componentRows);
    }

    const installedRows = MOCK_COMPONENTS.map((c) => ({
      component_id: `${workspaceId}:${appId}::${c.component_id}`,
      installed_at: new Date(),
    }));
    await tx.insert(installedComponents).values(installedRows);
  });
}
