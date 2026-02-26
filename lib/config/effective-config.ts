import { db } from '@/db/index';
import { appSettings, instanceConfigs, panelComponents, panelSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonRecord | JsonValue[];
interface JsonRecord {
  [key: string]: JsonValue;
}

function isPlainObject(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base: JsonRecord, override: JsonRecord): JsonRecord {
  const out: JsonRecord = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const previous = out[key];
    if (isPlainObject(previous) && isPlainObject(value)) {
      out[key] = deepMerge(previous, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function parseJsonObject(value: string | null | undefined): JsonRecord {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseJsonValue(value: string | null | undefined, fallback: JsonValue): JsonValue {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as JsonValue;
  } catch {
    return fallback;
  }
}

export type EffectiveConfigResult = {
  instance_id: string;
  panel_id: string;
  layers: {
    app: JsonRecord;
    panel: JsonRecord;
    instance: JsonRecord;
  };
  effective: JsonRecord;
};

export function loadAppComponentDefaults(): JsonRecord {
  const rows = db.select().from(appSettings).all();
  const allSettings = Object.fromEntries(
    rows.map((r) => {
      try {
        return [r.key, JSON.parse(r.value) as unknown];
      } catch {
        return [r.key, r.value];
      }
    })
  ) as JsonRecord;

  const defaults = allSettings.component_defaults;
  return isPlainObject(defaults) ? defaults : {};
}

export function loadPanelSettings(panelId: string): JsonRecord {
  const row = db
    .select()
    .from(panelSettings)
    .where(eq(panelSettings.panel_id, panelId))
    .get();

  return parseJsonObject(row?.settings);
}

export function loadInstanceSettings(instanceId: string): JsonRecord {
  const row = db
    .select()
    .from(instanceConfigs)
    .where(eq(instanceConfigs.instance_id, instanceId))
    .get();

  const componentRow = db
    .select({ front_props: panelComponents.front_props })
    .from(panelComponents)
    .where(eq(panelComponents.instance_id, instanceId))
    .get();

  const frontProps = parseJsonObject(componentRow?.front_props);
  if (!row) return frontProps;

  return {
    source_hub: row.source_hub,
    source_origin: row.source_origin,
    source_auth_ref: row.source_auth_ref,
    source_mode: row.source_mode,
    source_interval_ms: row.source_interval_ms,
    proc_executor: row.proc_executor,
    proc_command: row.proc_command,
    proc_args: parseJsonValue(row.proc_args, []),
    proc_timeout_ms: row.proc_timeout_ms,
    proc_retries: row.proc_retries,
    proc_backoff: row.proc_backoff,
    proc_error_mode: row.proc_error_mode,
    ...frontProps,
  };
}

export function resolveEffectiveConfig(instanceId: string): EffectiveConfigResult | null {
  const instanceRef = db
    .select({ instance_id: panelComponents.instance_id, panel_id: panelComponents.panel_id })
    .from(panelComponents)
    .where(eq(panelComponents.instance_id, instanceId))
    .get();

  if (!instanceRef) return null;

  const appLayer = loadAppComponentDefaults();
  const panelLayer = loadPanelSettings(instanceRef.panel_id);
  const instanceLayer = loadInstanceSettings(instanceRef.instance_id);

  const effective = deepMerge(deepMerge(appLayer, panelLayer), instanceLayer);

  return {
    instance_id: instanceRef.instance_id,
    panel_id: instanceRef.panel_id,
    layers: {
      app: appLayer,
      panel: panelLayer,
      instance: instanceLayer,
    },
    effective,
  };
}
