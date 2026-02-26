'use client';

import React from 'react';
import { Activity, Shield, Server, ListTree } from 'lucide-react';
import {
  useDaemonHealth,
  useDaemonRuntimeStatus,
  useDaemonWhoami,
  useDaemonEvents,
} from '@/lib/api/db-hooks';
import { resolveBindingValue, resolveObservabilityCascadeSettings } from '@/lib/config/component-settings';

function tiny(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '-';
  }
}

type ObservabilityHubProps = {
  effective?: Record<string, unknown>;
  bindings?: Record<string, unknown>;
  missing_required_tags?: string[];
};

export function ObservabilityHub({ effective, bindings, missing_required_tags }: ObservabilityHubProps) {
  const health = useDaemonHealth();
  const runtime = useDaemonRuntimeStatus();
  const whoami = useDaemonWhoami();
  const events = useDaemonEvents();

  const obsSettings = resolveObservabilityCascadeSettings(effective ?? {});
  const resolvedBindings = bindings ?? {};
  const sse = resolveBindingValue(resolvedBindings, ['transport:sse']);
  const websocket = resolveBindingValue(resolvedBindings, ['transport:websocket']);
  const webhook = resolveBindingValue(resolvedBindings, ['transport:webhook']);
  const eventLimit = obsSettings.event_limit;
  const kindContains = obsSettings.kind_contains;
  const eventRows = (events.data ?? [])
    .filter((evt) => {
      if (!kindContains) return true;
      return tiny(evt.kind).toLowerCase().includes(kindContains);
    })
    .slice(-eventLimit)
    .reverse();

  const cards = [
    {
      label: 'Health',
      icon: Activity,
      value: health.data?.ok ? 'UP' : health.isLoading ? 'CHECKING' : 'DOWN',
      tone: health.data?.ok ? 'text-emerald-400' : 'text-red-400',
    },
    {
      label: 'Profile',
      icon: Server,
      value: tiny(runtime.data?.active_profile),
      tone: 'text-blue-300',
    },
    {
      label: 'Auth',
      icon: Shield,
      value: tiny(whoami.data?.auth_type),
      tone: 'text-violet-300',
    },
    {
      label: 'Queue',
      icon: ListTree,
      value: tiny(runtime.data?.queue_depth),
      tone: 'text-amber-300',
    },
  ];

  return (
    <div className="w-full h-full flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        {cards.map((card) => (
          <div key={card.label} className="bg-white/[0.03] border border-white/10 rounded p-2">
            <div className="flex items-center justify-between text-white/40 text-[8px] uppercase tracking-wider">
              <span>{card.label}</span>
              <card.icon size={11} />
            </div>
            <div className={`mt-1 text-[11px] font-semibold truncate ${card.tone}`}>{card.value}</div>
          </div>
        ))}
      </div>
      <div className="text-[8px] text-white/45 bg-white/[0.03] border border-white/10 rounded p-2">
        <div>sse: {tiny(sse)}</div>
        <div>websocket: {tiny(websocket)}</div>
        <div>webhook: {tiny(webhook)}</div>
      </div>
      {missing_required_tags && missing_required_tags.length > 0 && (
        <div className="p-1.5 rounded border border-amber-400/20 bg-amber-400/10 text-[9px] text-amber-200">
          Missing tags: {missing_required_tags.join(', ')}
        </div>
      )}

      <div className="flex-1 min-h-0 bg-white/[0.03] border border-white/10 rounded p-2 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[9px] uppercase tracking-widest text-white/45">Recent Events</h4>
          <span className="text-[8px] text-white/30">{eventRows.length} shown</span>
        </div>

        <div className="flex-1 overflow-auto space-y-1 pr-1">
          {eventRows.length === 0 ? (
            <div className="text-[10px] text-white/35">No events yet</div>
          ) : (
            eventRows.map((evt, idx) => (
              <div key={`${tiny(evt.cursor)}-${idx}`} className="p-1.5 rounded bg-[#2a2a2a] border border-white/5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-white/80 truncate">{tiny(evt.kind)}</span>
                  <span className="text-[8px] text-white/35 font-mono">{tiny(evt.cursor)}</span>
                </div>
                <div className="text-[8px] text-white/35 font-mono mt-0.5">run_id: {tiny(evt.run_id)}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
