import { db } from '@/db/index';
import { appSettings, instanceConfigs, panelComponents, panelSettings, panels } from '@/db/schema';
import { MOCK_COMPONENTS } from '@/mocks/ublx-mocks';
import { and, eq } from 'drizzle-orm';
import { toScopedAppKey, toScopedKey } from '@/lib/auth/workspace';

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
  component_id: string;
  layers: {
    app: JsonRecord;
    panel: JsonRecord;
    instance: JsonRecord;
  };
  effective: JsonRecord;
  bindings: JsonRecord;
  binding_sources: Record<string, { source: 'instance' | 'panel' | 'app'; matched_tag: string }>;
  missing_required_tags: string[];
  app_scope?: string;
};

function withoutScopeContainers(layer: JsonRecord): JsonRecord {
  const { scopes: _scopes, apps: _apps, ...rest } = layer;
  return rest;
}

function resolveScopedAppLayer(allDefaults: JsonRecord, appScope?: string): JsonRecord {
  const base = withoutScopeContainers(allDefaults);
  if (!appScope) return base;

  const scopes = isPlainObject(allDefaults.scopes) ? allDefaults.scopes : {};
  const apps = isPlainObject(allDefaults.apps) ? allDefaults.apps : {};
  const scoped = (scopes[appScope] ?? apps[appScope]) as JsonValue;
  if (!isPlainObject(scoped)) return base;

  return deepMerge(base, scoped);
}

function parseTagBindings(layer: JsonRecord): Record<string, JsonValue> {
  const implicit: Record<string, JsonValue> = {};
  const maybe = (tag: string, key: string) => {
    const value = layer[key];
    if (value !== undefined && value !== null) {
      implicit[tag] = value;
    }
  };

  maybe('llm:api_key', 'llm_api_key');
  maybe('secret:api', 'api_key');
  maybe('secret:llm', 'llm_api_key');
  maybe('backend:llm_gateway:url', 'llm_gateway_base_url');
  maybe('secret:llm_gateway:key', 'llm_gateway_api_key');
  maybe('secret:llm_gateway:admin', 'llm_gateway_admin_key');
  maybe('transport:webhook', 'webhook_url');
  maybe('transport:websocket', 'websocket_url');
  maybe('transport:sse', 'sse_url');

  const candidate = layer.tag_bindings;
  if (!isPlainObject(candidate)) return implicit;
  const explicit = Object.fromEntries(
    Object.entries(candidate).filter(([key]) => typeof key === 'string')
  ) as Record<string, JsonValue>;
  return { ...implicit, ...explicit };
}

function tagMatches(requested: string, candidate: string): boolean {
  if (requested === candidate) return true;
  if (requested.endsWith('*')) {
    const prefix = requested.slice(0, -1);
    return candidate.startsWith(prefix);
  }
  return false;
}

function resolveBindingFromLayer(
  requestedTag: string,
  layerBindings: Record<string, JsonValue>
): { matched_tag: string; value: JsonValue } | null {
  if (requestedTag in layerBindings) {
    return { matched_tag: requestedTag, value: layerBindings[requestedTag] };
  }
  for (const [candidateTag, value] of Object.entries(layerBindings)) {
    if (tagMatches(requestedTag, candidateTag)) {
      return { matched_tag: candidateTag, value };
    }
  }
  return null;
}

function parseImportedTags(layer: JsonRecord, key: 'import_app_tags' | 'import_tab_tags'): string[] {
  const value = layer[key];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

export async function loadAppComponentDefaults(workspaceId: string, appId: string): Promise<JsonRecord> {
  const scopedAppKey = toScopedAppKey(workspaceId, appId, 'component_defaults');
  const scopedWorkspaceKey = toScopedKey(workspaceId, 'component_defaults');

  const appRows = await db.select().from(appSettings).where(eq(appSettings.key, scopedAppKey)).limit(1);
  const workspaceRows = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, scopedWorkspaceKey))
    .limit(1);

  const first = appRows[0] ?? workspaceRows[0];
  if (!first) return {};

  try {
    const parsed = JSON.parse(first.value) as unknown;
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function loadPanelSettings(panelId: string): Promise<JsonRecord> {
  const rows = await db
    .select()
    .from(panelSettings)
    .where(eq(panelSettings.panel_id, panelId))
    .limit(1);
  return parseJsonObject(rows[0]?.settings);
}

export async function loadInstanceSettings(instanceId: string): Promise<JsonRecord> {
  const rows = await db
    .select()
    .from(instanceConfigs)
    .where(eq(instanceConfigs.instance_id, instanceId))
    .limit(1);

  const componentRows = await db
    .select({ front_props: panelComponents.front_props })
    .from(panelComponents)
    .where(eq(panelComponents.instance_id, instanceId))
    .limit(1);

  const frontProps = parseJsonObject(componentRows[0]?.front_props);
  const row = rows[0];
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

export async function resolveEffectiveConfig(
  instanceId: string,
  workspaceId = 'default',
  appId = 'ublx'
): Promise<EffectiveConfigResult | null> {
  const refs = await db
    .select({
      instance_id: panelComponents.instance_id,
      panel_id: panelComponents.panel_id,
      component_id: panelComponents.component_id,
    })
    .from(panelComponents)
    .innerJoin(panels, eq(panelComponents.panel_id, panels.panel_id))
    .where(
      and(
        eq(panelComponents.instance_id, instanceId),
        eq(panels.workspace_id, workspaceId),
        eq(panels.app_id, appId)
      )
    )
    .limit(1);

  const instanceRef = refs[0];
  if (!instanceRef) return null;

  const instanceLayer = await loadInstanceSettings(instanceRef.instance_id);
  const scopeCandidate = instanceLayer.app_scope;
  const appScope = typeof scopeCandidate === 'string' && scopeCandidate.trim().length > 0
    ? scopeCandidate.trim()
    : undefined;

  const appLayerAll = await loadAppComponentDefaults(workspaceId, appId);
  const appLayer = resolveScopedAppLayer(appLayerAll, appScope);
  const panelLayer = await loadPanelSettings(instanceRef.panel_id);

  // Precedence contract:
  // 1) Scoped app defaults (by app_scope)
  // 2) Panel defaults
  // 3) Instance overrides
  // Special case: override_cascade=true -> instance layer only.
  const shouldOverrideCascade = instanceLayer.override_cascade === true;
  const effective = shouldOverrideCascade
    ? { ...instanceLayer }
    : deepMerge(deepMerge(appLayer, panelLayer), instanceLayer);
  const manifest = MOCK_COMPONENTS.find((c) => c.component_id === instanceRef.component_id);

  const appBindings = parseTagBindings(appLayer);
  const panelBindings = parseTagBindings(panelLayer);
  const instanceBindings = parseTagBindings(instanceLayer);
  const importAppTags = parseImportedTags(instanceLayer, 'import_app_tags');
  const importTabTags = parseImportedTags(instanceLayer, 'import_tab_tags');

  for (const tag of importTabTags) {
    if (tag in instanceBindings) continue;
    const resolved = resolveBindingFromLayer(tag, panelBindings);
    if (resolved) instanceBindings[tag] = resolved.value;
  }
  for (const tag of importAppTags) {
    if (tag in instanceBindings) continue;
    const resolved = resolveBindingFromLayer(tag, appBindings);
    if (resolved) instanceBindings[tag] = resolved.value;
  }

  const requiredTags = manifest?.required_binding_tags ?? [];
  const optionalTags = manifest?.optional_binding_tags ?? [];
  const requestedTags = Array.from(new Set([...requiredTags, ...optionalTags, ...importAppTags, ...importTabTags]));

  const resolvedBindings: JsonRecord = {};
  const bindingSources: Record<string, { source: 'instance' | 'panel' | 'app'; matched_tag: string }> = {};
  const missingRequiredTags: string[] = [];

  for (const requestedTag of requestedTags) {
    const fromInstance = resolveBindingFromLayer(requestedTag, instanceBindings);
    if (fromInstance) {
      resolvedBindings[requestedTag] = fromInstance.value;
      bindingSources[requestedTag] = { source: 'instance', matched_tag: fromInstance.matched_tag };
      continue;
    }

    if (!shouldOverrideCascade) {
      const fromPanel = resolveBindingFromLayer(requestedTag, panelBindings);
      if (fromPanel) {
        resolvedBindings[requestedTag] = fromPanel.value;
        bindingSources[requestedTag] = { source: 'panel', matched_tag: fromPanel.matched_tag };
        continue;
      }

      const fromApp = resolveBindingFromLayer(requestedTag, appBindings);
      if (fromApp) {
        resolvedBindings[requestedTag] = fromApp.value;
        bindingSources[requestedTag] = { source: 'app', matched_tag: fromApp.matched_tag };
        continue;
      }
    }

    if (requiredTags.includes(requestedTag)) {
      missingRequiredTags.push(requestedTag);
    }
  }

  return {
    instance_id: instanceRef.instance_id,
    panel_id: instanceRef.panel_id,
    component_id: instanceRef.component_id,
    layers: {
      app: appLayer,
      panel: panelLayer,
      instance: instanceLayer,
    },
    effective,
    bindings: resolvedBindings,
    binding_sources: bindingSources,
    missing_required_tags: missingRequiredTags,
    app_scope: appScope,
  };
}
