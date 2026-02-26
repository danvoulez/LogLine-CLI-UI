export type ChatCascadeSettings = {
  session_id?: string;
  auto_reply: boolean;
  assistant_prefix: string;
};

export type ObservabilityCascadeSettings = {
  event_limit: number;
  kind_contains: string;
};

export function resolveBindingValue(
  bindings: Record<string, unknown>,
  requestedTags: string[]
): unknown {
  for (const tag of requestedTags) {
    if (tag in bindings) return bindings[tag];
  }
  return undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function resolveChatCascadeSettings(effective: Record<string, unknown>): ChatCascadeSettings {
  return {
    session_id: asString(effective.chat_session_id),
    auto_reply: asBoolean(effective.chat_auto_reply, false),
    assistant_prefix: asString(effective.chat_assistant_prefix) ?? 'Noted',
  };
}

export function resolveObservabilityCascadeSettings(
  effective: Record<string, unknown>
): ObservabilityCascadeSettings {
  const limit = Math.trunc(asNumber(effective.observability_event_limit, 8));
  return {
    event_limit: Math.min(30, Math.max(1, limit)),
    kind_contains: asString(effective.observability_kind_contains)?.toLowerCase() ?? '',
  };
}
