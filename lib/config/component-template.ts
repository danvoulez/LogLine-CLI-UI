export type TemplateSize = 'unit' | 'line' | 'block';
export type TemplateHealthState = 'ok' | 'not_ok';
export type TemplateInfoTone = 'blue' | 'purple' | 'orange';
export const TEMPLATE_CONTRACT_VERSION = 1;
export const TEMPLATE_MIN_TELEMETRY_HOOKS = ['rendered', 'flip_opened', 'settings_saved', 'action_clicked', 'error_shown'] as const;
export const ALLOWED_CONNECTION_PROTOCOLS = ['websocket', 'sse', 'webhook', 'http', 'internal'] as const;

export type TemplateRefreshPolicy = {
  mode: 'manual' | 'interval' | 'stream';
  interval_ms: number;
};

export type TemplateConnectionContract = {
  type: 'websocket' | 'sse' | 'webhook' | 'http' | 'internal';
  ref: string;
  allowed_protocols: string[];
};

export type TemplateCliContract = {
  command: string;
  args: string[];
  timeout_ms: number;
  retries: number;
};

export type ComponentTemplateContract = {
  template_contract_version: number;
  app_scope: string;
  override_cascade: boolean;
  template_size: TemplateSize;
  health: TemplateHealthState;
  health_source: 'manual' | 'binding';
  info_tone: TemplateInfoTone;
  display_density: 'compact' | 'normal';
  interaction_mode: 'read-only' | 'actionable';
  refresh_policy: TemplateRefreshPolicy;
  empty_state_label: string;
  error_state_mode: 'badge' | 'inline' | 'silent';
  import_app_tags: string[];
  import_tab_tags: string[];
  required_bindings: string[];
  optional_bindings: string[];
  connection_contract: TemplateConnectionContract;
  cli_contract: TemplateCliContract;
  permissions: string[];
  mobile_priority: 'high' | 'normal' | 'low';
  telemetry_hooks: string[];
};

const BASE_TEMPLATE_CONTRACT: ComponentTemplateContract = {
  template_contract_version: TEMPLATE_CONTRACT_VERSION,
  app_scope: '',
  override_cascade: false,
  template_size: 'line',
  health: 'ok',
  health_source: 'manual',
  info_tone: 'blue',
  display_density: 'compact',
  interaction_mode: 'actionable',
  refresh_policy: {
    mode: 'manual',
    interval_ms: 30000,
  },
  empty_state_label: 'No data',
  error_state_mode: 'badge',
  import_app_tags: [],
  import_tab_tags: [],
  required_bindings: [],
  optional_bindings: [],
  connection_contract: {
    type: 'websocket',
    ref: '',
    allowed_protocols: [...ALLOWED_CONNECTION_PROTOCOLS],
  },
  cli_contract: {
    command: '',
    args: [],
    timeout_ms: 15000,
    retries: 1,
  },
  permissions: [],
  mobile_priority: 'normal',
  telemetry_hooks: [...TEMPLATE_MIN_TELEMETRY_HOOKS],
};

const SIZE_DEFAULTS: Record<string, TemplateSize> = {
  'service-card': 'line',
  'drop-zone': 'block',
  'llm-status': 'line',
  'quick-files': 'block',
  'registry': 'block',
  'pipeline-editor': 'block',
  'smart-list': 'line',
  'chat-ai': 'block',
  'observability-hub': 'block',
  'billing-daily': 'line',
  'secret-field': 'unit',
  'status-ticker': 'line',
  'alert-tracker': 'line',
  'signal-graph': 'block',
  'incident-feed': 'block',
};

const MOBILE_PRIORITY_DEFAULTS: Record<string, ComponentTemplateContract['mobile_priority']> = {
  'observability-hub': 'high',
  'billing-daily': 'high',
  'chat-ai': 'high',
  'llm-status': 'normal',
  'service-card': 'normal',
  'status-ticker': 'high',
  'alert-tracker': 'high',
  'signal-graph': 'normal',
  'incident-feed': 'normal',
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asStringArray(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) return fallback;
  return value.filter((entry): entry is string => typeof entry === 'string');
}

export function isAllowedConnectionType(value: string): value is TemplateConnectionContract['type'] {
  return (ALLOWED_CONNECTION_PROTOCOLS as readonly string[]).includes(value);
}

export function isCliCommandAllowed(command: string): boolean {
  const trimmed = command.trim();
  if (trimmed.length === 0) return true;
  if (trimmed.length > 180) return false;
  // Reject shell metacharacters that would allow command chaining/subshells.
  return !/[;&|`$<>]/.test(trimmed);
}

export function emitTemplateTelemetry(hook: string, payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('ublx:template-telemetry', {
      detail: { hook, ...payload, at: Date.now() },
    })
  );
}

export function resolveTemplateContract(componentId: string, frontProps?: Record<string, unknown>): ComponentTemplateContract {
  const raw = frontProps ?? {};
  const refreshPolicyRaw = asRecord(raw.refresh_policy);
  const connectionRaw = asRecord(raw.connection_contract);
  const cliRaw = asRecord(raw.cli_contract);

  const fallbackSize = SIZE_DEFAULTS[componentId] ?? BASE_TEMPLATE_CONTRACT.template_size;
  const explicitSize = raw.template_size;
  const templateSize: TemplateSize = explicitSize === 'unit' || explicitSize === 'line' || explicitSize === 'block'
    ? explicitSize
    : fallbackSize;

  const infoToneRaw = raw.info_tone;
  const infoTone: TemplateInfoTone =
    infoToneRaw === 'blue' || infoToneRaw === 'purple' || infoToneRaw === 'orange'
      ? infoToneRaw
      : BASE_TEMPLATE_CONTRACT.info_tone;

  const healthRaw = raw.health;
  const health: TemplateHealthState = healthRaw === 'not_ok' ? 'not_ok' : 'ok';

  const mobilePriorityRaw = raw.mobile_priority;
  const mobilePriority: ComponentTemplateContract['mobile_priority'] =
    mobilePriorityRaw === 'high' || mobilePriorityRaw === 'normal' || mobilePriorityRaw === 'low'
      ? mobilePriorityRaw
      : MOBILE_PRIORITY_DEFAULTS[componentId] ?? BASE_TEMPLATE_CONTRACT.mobile_priority;

  const refreshModeRaw = refreshPolicyRaw.mode;
  const refreshMode: TemplateRefreshPolicy['mode'] =
    refreshModeRaw === 'manual' || refreshModeRaw === 'interval' || refreshModeRaw === 'stream'
      ? refreshModeRaw
      : BASE_TEMPLATE_CONTRACT.refresh_policy.mode;

  const refreshInterval =
    typeof refreshPolicyRaw.interval_ms === 'number' && Number.isFinite(refreshPolicyRaw.interval_ms)
      ? Math.max(1000, Math.trunc(refreshPolicyRaw.interval_ms))
      : BASE_TEMPLATE_CONTRACT.refresh_policy.interval_ms;

  const connectionTypeRaw = raw.connection_type ?? connectionRaw.type;
  const connectionType: TemplateConnectionContract['type'] = isAllowedConnectionType(String(connectionTypeRaw))
    ? connectionTypeRaw
    : BASE_TEMPLATE_CONTRACT.connection_contract.type;

  const cliCommand = asString(raw.cli_command ?? cliRaw.command, BASE_TEMPLATE_CONTRACT.cli_contract.command);

  return {
    template_contract_version:
      typeof raw.template_contract_version === 'number' && Number.isFinite(raw.template_contract_version)
        ? Math.max(1, Math.trunc(raw.template_contract_version))
        : TEMPLATE_CONTRACT_VERSION,
    app_scope: asString(raw.app_scope, BASE_TEMPLATE_CONTRACT.app_scope),
    override_cascade: asBool(raw.override_cascade, BASE_TEMPLATE_CONTRACT.override_cascade),
    template_size: templateSize,
    health,
    health_source: raw.health_source === 'binding' ? 'binding' : 'manual',
    info_tone: infoTone,
    display_density: raw.display_density === 'normal' ? 'normal' : 'compact',
    interaction_mode: raw.interaction_mode === 'read-only' ? 'read-only' : 'actionable',
    refresh_policy: {
      mode: refreshMode,
      interval_ms: refreshInterval,
    },
    empty_state_label: asString(raw.empty_state_label, BASE_TEMPLATE_CONTRACT.empty_state_label),
    error_state_mode:
      raw.error_state_mode === 'inline' || raw.error_state_mode === 'silent' ? raw.error_state_mode : 'badge',
    import_app_tags: asStringArray(raw.import_app_tags),
    import_tab_tags: asStringArray(raw.import_tab_tags),
    required_bindings: asStringArray(raw.required_bindings),
    optional_bindings: asStringArray(raw.optional_bindings),
    connection_contract: {
      type: connectionType,
      ref: asString(raw.connection_ref ?? connectionRaw.ref, BASE_TEMPLATE_CONTRACT.connection_contract.ref),
      allowed_protocols: asStringArray(connectionRaw.allowed_protocols, BASE_TEMPLATE_CONTRACT.connection_contract.allowed_protocols)
        .filter(isAllowedConnectionType),
    },
    cli_contract: {
      command: isCliCommandAllowed(cliCommand) ? cliCommand : BASE_TEMPLATE_CONTRACT.cli_contract.command,
      args: asStringArray(cliRaw.args, BASE_TEMPLATE_CONTRACT.cli_contract.args),
      timeout_ms:
        typeof cliRaw.timeout_ms === 'number' && Number.isFinite(cliRaw.timeout_ms)
          ? Math.max(1000, Math.trunc(cliRaw.timeout_ms))
          : BASE_TEMPLATE_CONTRACT.cli_contract.timeout_ms,
      retries:
        typeof cliRaw.retries === 'number' && Number.isFinite(cliRaw.retries)
          ? Math.max(0, Math.trunc(cliRaw.retries))
          : BASE_TEMPLATE_CONTRACT.cli_contract.retries,
    },
    permissions: asStringArray(raw.permissions),
    mobile_priority: mobilePriority,
    telemetry_hooks: Array.from(
      new Set([
        ...TEMPLATE_MIN_TELEMETRY_HOOKS,
        ...asStringArray(raw.telemetry_hooks, BASE_TEMPLATE_CONTRACT.telemetry_hooks),
      ])
    ),
  };
}

export function normalizeTemplateFrontProps(componentId: string, frontProps?: Record<string, unknown>): Record<string, unknown> {
  const contract = resolveTemplateContract(componentId, frontProps);
  return {
    ...(frontProps ?? {}),
    template_contract_version: contract.template_contract_version,
    app_scope: contract.app_scope,
    override_cascade: contract.override_cascade,
    template_size: contract.template_size,
    health: contract.health,
    health_source: contract.health_source,
    info_tone: contract.info_tone,
    display_density: contract.display_density,
    interaction_mode: contract.interaction_mode,
    refresh_policy: contract.refresh_policy,
    empty_state_label: contract.empty_state_label,
    error_state_mode: contract.error_state_mode,
    import_app_tags: contract.import_app_tags,
    import_tab_tags: contract.import_tab_tags,
    required_bindings: contract.required_bindings,
    optional_bindings: contract.optional_bindings,
    connection_type: contract.connection_contract.type,
    connection_ref: contract.connection_contract.ref,
    connection_contract: contract.connection_contract,
    cli_command: contract.cli_contract.command,
    cli_contract: contract.cli_contract,
    permissions: contract.permissions,
    mobile_priority: contract.mobile_priority,
    telemetry_hooks: contract.telemetry_hooks,
  };
}

export function mobilePriorityRank(priority: ComponentTemplateContract['mobile_priority']): number {
  if (priority === 'high') return 0;
  if (priority === 'normal') return 1;
  return 2;
}
