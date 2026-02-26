import { db } from './index';
import { panels, panelComponents, tabMeta, installedComponents } from './schema';
import { MOCK_PANELS, MOCK_COMPONENTS } from '@/mocks/ublx-mocks';
import {
  normalizeRectToPresets,
  resolveAllowedPresetIds,
  resolveDefaultPresetId,
} from '@/lib/layout/grid-presets';

const PANEL_ICONS: Record<string, string> = {
  home: 'Home',
  ops:  'Activity',
};

export function seedDefaultData(): void {
  // Double-check inside the seed — called only when panels table is empty
  const existingCount = db.select().from(panels).all().length;
  if (existingCount > 0) return;

  // Use a transaction so either all seed data is written or none of it is
  db.transaction((tx) => {
    // 1. Panels
    const panelRows = MOCK_PANELS.map((p, idx) => ({
      panel_id:   p.panel_id,
      name:       p.name,
      position:   idx,
      version:    p.version,
      created_at: new Date(),
      updated_at: new Date(),
    }));
    tx.insert(panels).values(panelRows).run();

    // 2. Tab meta
    const tabMetaRows = MOCK_PANELS.map((p, idx) => ({
      panel_id: p.panel_id,
      icon:     PANEL_ICONS[p.panel_id] ?? 'FileText',
      label:    p.name,
      shortcut: idx + 1 <= 9 ? idx + 1 : null,
    }));
    tx.insert(tabMeta).values(tabMetaRows).run();

    // 3. Panel components
    const componentRows = MOCK_PANELS.flatMap((p, _panelIdx) =>
      p.components.map((c, compIdx) => {
        const def = MOCK_COMPONENTS.find((m) => m.component_id === c.component_id);
        const allowed = resolveAllowedPresetIds(def);
        const preset = resolveDefaultPresetId(def);
        const normalized = normalizeRectToPresets(c.rect, allowed, { cols: 32, rows: 24 }, preset);

        return {
          instance_id:  c.instance_id,
          panel_id:     p.panel_id,
          component_id: c.component_id,
          version:      c.version,
          rect_x:       normalized.rect.x,
          rect_y:       normalized.rect.y,
          rect_w:       normalized.rect.w,
          rect_h:       normalized.rect.h,
          front_props:  JSON.stringify({
            ...(c.front_props ?? {}),
            size_preset: normalized.presetId,
            allowed_size_presets: allowed,
          }),
          position:     compIdx,
          created_at:   new Date(),
          updated_at:   new Date(),
        };
      })
    );

    if (componentRows.length > 0) {
      tx.insert(panelComponents).values(componentRows).run();
    }

    // 4. Installed components — seed all from MOCK_COMPONENTS
    const installedRows = MOCK_COMPONENTS.map((c) => ({
      component_id: c.component_id,
      installed_at: new Date(),
    }));
    tx.insert(installedComponents).values(installedRows).run();
  });
}
