import type { ComponentManifest, Rect } from '@/types/ublx';

export type SizePresetId = 'S' | 'M' | 'L' | 'XL' | 'WIDE';

export const GRID_SIZE_PRESETS: Record<SizePresetId, { w: number; h: number }> = {
  S: { w: 4, h: 4 },
  M: { w: 8, h: 4 },
  L: { w: 8, h: 8 },
  XL: { w: 12, h: 8 },
  WIDE: { w: 12, h: 4 },
};

export const ALL_SIZE_PRESET_IDS: SizePresetId[] = ['S', 'M', 'L', 'XL', 'WIDE'];

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function resolveAllowedPresetIds(component?: ComponentManifest): SizePresetId[] {
  if (!component) return [...ALL_SIZE_PRESET_IDS];

  if (component.allowed_size_presets && component.allowed_size_presets.length > 0) {
    return component.allowed_size_presets.filter((p): p is SizePresetId => p in GRID_SIZE_PRESETS);
  }

  const limits = component.limits;
  if (!limits) return [...ALL_SIZE_PRESET_IDS];

  const filtered = ALL_SIZE_PRESET_IDS.filter((id) => {
    const size = GRID_SIZE_PRESETS[id];
    return (
      size.w >= limits.min_w &&
      size.w <= limits.max_w &&
      size.h >= limits.min_h &&
      size.h <= limits.max_h
    );
  });

  return filtered.length > 0 ? filtered : [...ALL_SIZE_PRESET_IDS];
}

export function resolveDefaultPresetId(component?: ComponentManifest): SizePresetId {
  const allowed = resolveAllowedPresetIds(component);
  if (
    component?.default_size_preset &&
    allowed.includes(component.default_size_preset as SizePresetId)
  ) {
    return component.default_size_preset as SizePresetId;
  }
  return allowed[0] ?? 'M';
}

export function nearestPresetIdForSize(
  size: { w: number; h: number },
  allowed: SizePresetId[]
): SizePresetId {
  const candidates = allowed.length > 0 ? allowed : ALL_SIZE_PRESET_IDS;

  return candidates
    .map((id) => {
      const s = GRID_SIZE_PRESETS[id];
      const distance = Math.abs(s.w - size.w) + Math.abs(s.h - size.h);
      return { id, distance };
    })
    .sort((a, b) => a.distance - b.distance)[0]!.id;
}

export function normalizeRectToPresets(
  rect: Rect,
  allowed: SizePresetId[],
  grid: { cols: number; rows: number },
  preferredPreset?: SizePresetId
): { rect: Rect; presetId: SizePresetId } {
  const validAllowed = allowed.length > 0 ? allowed : ALL_SIZE_PRESET_IDS;
  const presetId =
    preferredPreset && validAllowed.includes(preferredPreset)
      ? preferredPreset
      : nearestPresetIdForSize(rect, validAllowed);

  const size = GRID_SIZE_PRESETS[presetId];
  const maxX = Math.max(0, grid.cols - size.w);
  const maxY = Math.max(0, grid.rows - size.h);

  return {
    presetId,
    rect: {
      x: Math.min(Math.max(0, rect.x), maxX),
      y: Math.min(Math.max(0, rect.y), maxY),
      w: size.w,
      h: size.h,
    },
  };
}

export function findFirstAvailablePlacement(
  existing: Rect[],
  presetId: SizePresetId,
  grid: { cols: number; rows: number }
): Rect | null {
  const size = GRID_SIZE_PRESETS[presetId];

  for (let y = 0; y <= grid.rows - size.h; y += 1) {
    for (let x = 0; x <= grid.cols - size.w; x += 1) {
      const candidate: Rect = { x, y, w: size.w, h: size.h };
      if (!existing.some((r) => rectsOverlap(candidate, r))) {
        return candidate;
      }
    }
  }
  return null;
}
