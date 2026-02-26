'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import type { PanelManifest, PanelComponentInstance } from '@/types/ublx';

type ChatRow = {
  id: string;
  session_id: string;
  panel_id: string | null;
  instance_id: string | null;
  role: 'user' | 'assistant';
  content: string;
  model_used: string | null;
  latency_ms: number | null;
  created_at: string;
};

function resolveWorkspaceId(): string {
  if (typeof window === 'undefined') return 'default';
  const fromStorage = window.localStorage.getItem('ublx_workspace_id')?.trim();
  return fromStorage || 'default';
}

// ── Internal fetch helper ─────────────────────────────────────────────────────
async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const workspaceId = resolveWorkspaceId();
  const mergedHeaders = new Headers(options?.headers);
  if (!mergedHeaders.has('Content-Type')) mergedHeaders.set('Content-Type', 'application/json');
  mergedHeaders.set('x-workspace-id', workspaceId);
  const res = await fetch(url, {
    ...options,
    headers: mergedHeaders,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function gatewayFetchJson<T>(
  path: string,
  opts: { baseUrl: string; token?: string; method?: string; body?: unknown; search?: string }
): Promise<T> {
  const workspaceId = resolveWorkspaceId();
  const res = await fetch(`/api/llm-gateway${path}${opts.search ?? ''}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-workspace-id': workspaceId,
      'x-llm-gateway-base-url': opts.baseUrl,
      ...(opts.token ? { authorization: opts.token.startsWith('Bearer ') ? opts.token : `Bearer ${opts.token}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gateway ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function gatewayFetchText(
  path: string,
  opts: { baseUrl: string; token?: string; search?: string }
): Promise<string> {
  const workspaceId = resolveWorkspaceId();
  const res = await fetch(`/api/llm-gateway${path}${opts.search ?? ''}`, {
    headers: {
      'x-workspace-id': workspaceId,
      'x-llm-gateway-base-url': opts.baseUrl,
      ...(opts.token ? { authorization: opts.token.startsWith('Bearer ') ? opts.token : `Bearer ${opts.token}` } : {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gateway ${res.status}: ${text}`);
  }
  return res.text();
}

// ── Centralized query keys ────────────────────────────────────────────────────
export const QUERY_KEYS = {
  panels:              ['panels']                                    as const,
  panelComponents:     (panelId: string) => ['panels', panelId, 'components'] as const,
  instanceConfig:      (instanceId: string) => ['instance-configs', instanceId] as const,
  installedComponents: ['installed-components']                      as const,
  tabMeta:             (panelId: string) => ['tab-meta', panelId]   as const,
  panelSettings:       (panelId: string) => ['panel-settings', panelId] as const,
  effectiveConfig:     (instanceId: string) => ['effective-config', instanceId] as const,
  chatHistory:         (sessionId: string) => ['chat', sessionId]   as const,
  settings:            ['settings']                                  as const,
  statusLog:           ['status-log']                                as const,
  gatewayFuel:         (baseUrl: string) => ['gateway', 'fuel', baseUrl] as const,
  gatewayFuelDaily:    (baseUrl: string) => ['gateway', 'fuel-daily', baseUrl] as const,
  gatewayUsageDaily:   (baseUrl: string, day: string, limit: number) => ['gateway', 'usage-daily', baseUrl, day, limit] as const,
  gatewayMetrics:      (baseUrl: string) => ['gateway', 'metrics', baseUrl] as const,
};

// ── Panels ────────────────────────────────────────────────────────────────────
export function usePanels() {
  return useQuery<PanelManifest[]>({
    queryKey: QUERY_KEYS.panels,
    queryFn:  () => apiFetch<PanelManifest[]>('/api/panels'),
  });
}

export function useCreatePanel() {
  const qc = useQueryClient();
  return useMutation<PanelManifest, Error, { name: string }>({
    mutationFn: (body) =>
      apiFetch<PanelManifest>('/api/panels', {
        method: 'POST',
        body:   JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.panels }),
  });
}

export function useRenamePanel() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, { panelId: string; name: string }>({
    mutationFn: ({ panelId, name }) =>
      apiFetch(`/api/panels/${panelId}`, {
        method: 'PATCH',
        body:   JSON.stringify({ name }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.panels }),
  });
}

export function useDeletePanel() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, { panelId: string }>({
    mutationFn: ({ panelId }) =>
      apiFetch(`/api/panels/${panelId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.panels }),
  });
}

// ── Panel components ──────────────────────────────────────────────────────────
export function usePanelComponents(panelId: string) {
  return useQuery<PanelComponentInstance[]>({
    queryKey: QUERY_KEYS.panelComponents(panelId),
    queryFn:  () =>
      apiFetch<PanelComponentInstance[]>(`/api/panels/${panelId}/components`),
    enabled: !!panelId,
  });
}

export function useAddComponent() {
  const qc = useQueryClient();
  return useMutation<PanelComponentInstance, Error, { panelId: string; componentId: string }>({
    mutationFn: ({ panelId, componentId }) =>
      apiFetch<PanelComponentInstance>(`/api/panels/${panelId}/components`, {
        method: 'POST',
        body:   JSON.stringify({ componentId }),
      }),
    onSuccess: (_data, { panelId }) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.panels });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.panelComponents(panelId) });
    },
  });
}

export function useRemoveComponent() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, { panelId: string; instanceId: string }>({
    mutationFn: ({ panelId, instanceId }) =>
      apiFetch(`/api/panels/${panelId}/components/${instanceId}`, {
        method: 'DELETE',
      }),
    onSuccess: (_data, { panelId }) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.panels });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.panelComponents(panelId) });
    },
  });
}

export function useUpdateComponentFrontProps() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, { panelId: string; instanceId: string; front_props: Record<string, unknown> }>({
    mutationFn: ({ panelId, instanceId, front_props }) =>
      apiFetch(`/api/panels/${panelId}/components/${instanceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ front_props }),
      }),
    onSuccess: (_data, { panelId, instanceId }) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.panels });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.panelComponents(panelId) });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.effectiveConfig(instanceId) });
    },
  });
}

export function useUpdateComponentRect() {
  const qc = useQueryClient();
  return useMutation<
    { ok: boolean },
    Error,
    { panelId: string; instanceId: string; rect: { x: number; y: number; w: number; h: number } }
  >({
    mutationFn: ({ panelId, instanceId, rect }) =>
      apiFetch(`/api/panels/${panelId}/components/${instanceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ rect }),
      }),
    onSuccess: (_data, { panelId, instanceId }) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.panels });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.panelComponents(panelId) });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.effectiveConfig(instanceId) });
    },
  });
}

// ── Instance config ───────────────────────────────────────────────────────────
export function useInstanceConfig(instanceId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.instanceConfig(instanceId),
    queryFn:  () => apiFetch(`/api/instance-configs/${instanceId}`),
    enabled:  !!instanceId,
  });
}

export function useSaveInstanceConfig() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, { instanceId: string; config: Record<string, unknown> }>({
    mutationFn: ({ instanceId, config }) =>
      apiFetch(`/api/instance-configs/${instanceId}`, {
        method: 'PUT',
        body:   JSON.stringify(config),
      }),
    onSuccess: (_data, { instanceId }) =>
      qc.invalidateQueries({ queryKey: QUERY_KEYS.instanceConfig(instanceId) }),
  });
}

// ── Installed components ──────────────────────────────────────────────────────
export function useInstalledComponents() {
  return useQuery<{ component_id: string; installed_at: number }[]>({
    queryKey: QUERY_KEYS.installedComponents,
    queryFn:  () =>
      apiFetch<{ component_id: string; installed_at: number }[]>('/api/installed-components'),
  });
}

export function useInstallComponent() {
  const qc = useQueryClient();
  return useMutation<{ component_id: string; installed_at: number }, Error, { componentId: string }>({
    mutationFn: ({ componentId }) =>
      apiFetch('/api/installed-components', {
        method: 'POST',
        body:   JSON.stringify({ componentId }),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: QUERY_KEYS.installedComponents }),
  });
}

export function useUninstallComponent() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, { componentId: string }>({
    mutationFn: ({ componentId }) =>
      apiFetch(`/api/installed-components/${componentId}`, { method: 'DELETE' }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: QUERY_KEYS.installedComponents }),
  });
}

// ── Tab meta ──────────────────────────────────────────────────────────────────
export function useTabMeta(panelId: string) {
  return useQuery<{ panel_id: string; icon: string | null; label: string | null; shortcut: number | null } | null>({
    queryKey: QUERY_KEYS.tabMeta(panelId),
    queryFn:  () => apiFetch(`/api/tab-meta/${panelId}`),
    enabled:  !!panelId,
  });
}

export function useSaveTabMeta() {
  const qc = useQueryClient();
  return useMutation<
    { ok: boolean },
    Error,
    { panelId: string; icon?: string; label?: string; shortcut?: number }
  >({
    mutationFn: ({ panelId, ...body }) =>
      apiFetch(`/api/tab-meta/${panelId}`, {
        method: 'PUT',
        body:   JSON.stringify(body),
      }),
    onSuccess: (_data, { panelId }) =>
      qc.invalidateQueries({ queryKey: QUERY_KEYS.tabMeta(panelId) }),
  });
}

// ── Panel settings ────────────────────────────────────────────────────────────
export function usePanelSettings(panelId: string) {
  return useQuery<{ panel_id: string; settings: Record<string, unknown> }>({
    queryKey: QUERY_KEYS.panelSettings(panelId),
    queryFn:  () => apiFetch(`/api/panel-settings/${panelId}`),
    enabled:  !!panelId,
  });
}

export function useSavePanelSettings() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, { panelId: string; settings: Record<string, unknown> }>({
    mutationFn: ({ panelId, settings }) =>
      apiFetch(`/api/panel-settings/${panelId}`, {
        method: 'PUT',
        body:   JSON.stringify(settings),
      }),
    onSuccess: (_data, { panelId }) =>
      qc.invalidateQueries({ queryKey: QUERY_KEYS.panelSettings(panelId) }),
  });
}

// ── Effective config ──────────────────────────────────────────────────────────
export function useEffectiveConfig(instanceId: string) {
  return useQuery<{
    instance_id: string;
    panel_id: string;
    component_id: string;
    layers: {
      app: Record<string, unknown>;
      panel: Record<string, unknown>;
      instance: Record<string, unknown>;
    };
    effective: Record<string, unknown>;
    bindings: Record<string, unknown>;
    binding_sources: Record<string, { source: 'instance' | 'panel' | 'app'; matched_tag: string }>;
    missing_required_tags: string[];
  }>({
    queryKey: QUERY_KEYS.effectiveConfig(instanceId),
    queryFn:  () => apiFetch(`/api/effective-config/${instanceId}`),
    enabled:  !!instanceId,
  });
}

// ── Chat ──────────────────────────────────────────────────────────────────────
export function useChatHistory(sessionId: string) {
  return useQuery<ChatRow[]>({
    queryKey: QUERY_KEYS.chatHistory(sessionId),
    queryFn:  () =>
      apiFetch<ChatRow[]>(`/api/chat?session_id=${encodeURIComponent(sessionId)}`),
    enabled: !!sessionId,
  });
}

export function useSendChatMessage() {
  const qc = useQueryClient();
  return useMutation<
    Record<string, unknown>,
    Error,
    {
      session_id:    string;
      role:          'user' | 'assistant';
      content:       string;
      panel_id?:     string;
      instance_id?:  string;
      model_used?:   string;
      latency_ms?:   number;
    }
  >({
    mutationFn: (msg) =>
      apiFetch('/api/chat', {
        method: 'POST',
        body:   JSON.stringify(msg),
      }),
    onSuccess: (_data, { session_id }) =>
      qc.invalidateQueries({ queryKey: QUERY_KEYS.chatHistory(session_id) }),
  });
}

export function useGatewayChatCompletion() {
  return useMutation<
    Record<string, unknown>,
    Error,
    {
      baseUrl: string;
      token: string;
      model: string;
      messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
    }
  >({
    mutationFn: ({ baseUrl, token, model, messages }) =>
      gatewayFetchJson('/v1/chat/completions', {
        baseUrl,
        token,
        method: 'POST',
        body: { model, messages },
      }),
  });
}

export function useGatewayFuel(baseUrl?: string, token?: string) {
  return useQuery<Record<string, unknown>>({
    queryKey: QUERY_KEYS.gatewayFuel(baseUrl ?? ''),
    queryFn: () => gatewayFetchJson('/v1/fuel', { baseUrl: baseUrl ?? '', token }),
    enabled: !!baseUrl,
    refetchInterval: 20_000,
  });
}

export function useGatewayFuelDaily(baseUrl?: string, token?: string) {
  return useQuery<Record<string, unknown>>({
    queryKey: QUERY_KEYS.gatewayFuelDaily(baseUrl ?? ''),
    queryFn: () => gatewayFetchJson('/v1/fuel/daily', { baseUrl: baseUrl ?? '', token }),
    enabled: !!baseUrl,
    refetchInterval: 30_000,
  });
}

export function useGatewayUsageDaily(baseUrl?: string, adminToken?: string, day?: string, limit = 100) {
  const resolvedDay = day || new Date().toISOString().slice(0, 10);
  return useQuery<Record<string, unknown>>({
    queryKey: QUERY_KEYS.gatewayUsageDaily(baseUrl ?? '', resolvedDay, limit),
    queryFn: () =>
      gatewayFetchJson('/v1/admin/usage/daily', {
        baseUrl: baseUrl ?? '',
        token: adminToken,
        search: `?day=${encodeURIComponent(resolvedDay)}&limit=${limit}`,
      }),
    enabled: !!baseUrl && !!adminToken,
    refetchInterval: 60_000,
  });
}

export function useGatewayMetrics(baseUrl?: string, token?: string) {
  return useQuery<string>({
    queryKey: QUERY_KEYS.gatewayMetrics(baseUrl ?? ''),
    queryFn: () => gatewayFetchText('/metrics', { baseUrl: baseUrl ?? '', token }),
    enabled: !!baseUrl,
    refetchInterval: 30_000,
  });
}

// ── Settings ──────────────────────────────────────────────────────────────────
export function useSettings() {
  return useQuery<Record<string, unknown>>({
    queryKey: QUERY_KEYS.settings,
    queryFn:  () => apiFetch('/api/settings'),
  });
}

export function useUpdateSetting() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, { key: string; value: unknown }>({
    mutationFn: (body) =>
      apiFetch('/api/settings', {
        method: 'PATCH',
        body:   JSON.stringify(body),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: QUERY_KEYS.settings }),
  });
}

// ── Status log ────────────────────────────────────────────────────────────────
export function useStatusLog(limit = 50) {
  return useQuery({
    queryKey: [...QUERY_KEYS.statusLog, limit],
    queryFn:  () => apiFetch(`/api/status-log?limit=${limit}`),
    refetchInterval: 30_000,
  });
}

export function useLogStatus() {
  const qc = useQueryClient();
  return useMutation<
    { ok: boolean },
    Error,
    { service_name: string; status: string; latency_ms?: number }
  >({
    mutationFn: (body) =>
      apiFetch('/api/status-log', {
        method: 'POST',
        body:   JSON.stringify(body),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: QUERY_KEYS.statusLog }),
  });
}

// ── Logline daemon wiring ────────────────────────────────────────────────────
export function useDaemonHealth() {
  return useQuery<{ ok: boolean }>({
    queryKey: ['logline', 'health'],
    queryFn: () => apiFetch('/api/logline/v1/health'),
    refetchInterval: 15_000,
  });
}

export function useDaemonRuntimeStatus() {
  return useQuery<Record<string, unknown>>({
    queryKey: ['logline', 'status'],
    queryFn: () => apiFetch('/api/logline/v1/status'),
    refetchInterval: 20_000,
  });
}

export function useDaemonWhoami() {
  return useQuery<Record<string, unknown>>({
    queryKey: ['logline', 'whoami'],
    queryFn: () => apiFetch('/api/logline/v1/auth/whoami'),
    refetchInterval: 30_000,
  });
}

export function useDaemonEvents(since?: string) {
  return useQuery<Record<string, unknown>[]>({
    queryKey: ['logline', 'events', since ?? 'latest'],
    queryFn: () => {
      const q = since ? `?since=${encodeURIComponent(since)}` : '';
      return apiFetch(`/api/logline/v1/events${q}`);
    },
    refetchInterval: 20_000,
  });
}

export function useDaemonRunIntent() {
  const qc = useQueryClient();
  return useMutation<Record<string, unknown>, Error, { intent_type: string; payload?: Record<string, string> }>({
    mutationFn: (body) =>
      apiFetch('/api/logline/v1/intents/run', {
        method: 'POST',
        body: JSON.stringify({ intent_type: body.intent_type, payload: body.payload ?? {} }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['logline', 'status'] });
      qc.invalidateQueries({ queryKey: ['logline', 'events'] });
    },
  });
}

export function useDaemonStopIntent() {
  const qc = useQueryClient();
  return useMutation<Record<string, unknown>, Error, { run_id: string }>({
    mutationFn: (body) =>
      apiFetch('/api/logline/v1/intents/stop', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['logline', 'status'] });
      qc.invalidateQueries({ queryKey: ['logline', 'events'] });
    },
  });
}

export function useDaemonSelectProfile() {
  const qc = useQueryClient();
  return useMutation<Record<string, unknown>, Error, { profile_id: string }>({
    mutationFn: (body) =>
      apiFetch('/api/logline/v1/profiles/select', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['logline', 'status'] });
      qc.invalidateQueries({ queryKey: ['logline', 'events'] });
    },
  });
}
