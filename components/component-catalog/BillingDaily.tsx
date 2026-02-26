'use client';

import React from 'react';
import { resolveBindingValue } from '@/lib/config/component-settings';
import { useGatewayUsageDaily } from '@/lib/api/db-hooks';

type BillingDailyProps = {
  effective?: Record<string, unknown>;
  bindings?: Record<string, unknown>;
  missing_required_tags?: string[];
};

type UsageRow = {
  app_name?: string;
  mode_used?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
};

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function BillingDaily({ effective, bindings, missing_required_tags }: BillingDailyProps) {
  const resolvedBindings = bindings ?? {};
  const baseUrl = resolveBindingValue(resolvedBindings, ['backend:llm_gateway:url']) as string | undefined;
  const adminKey = resolveBindingValue(resolvedBindings, ['secret:llm_gateway:admin']) as string | undefined;
  const day = typeof effective?.billing_day === 'string' ? effective.billing_day : undefined;
  const usageDaily = useGatewayUsageDaily(baseUrl, adminKey, day, 200);

  const inRate = asNumber(effective?.billing_in_rate, 0.000002);
  const outRate = asNumber(effective?.billing_out_rate, 0.000004);

  const rows: UsageRow[] = (() => {
    const data = usageDaily.data as Record<string, unknown> | undefined;
    const maybeRows = data?.rows;
    return Array.isArray(maybeRows) ? (maybeRows as UsageRow[]) : [];
  })();

  const priced = rows.map((row) => {
    const prompt = asNumber(row.prompt_tokens, 0);
    const completion = asNumber(row.completion_tokens, 0);
    const cost = prompt * inRate + completion * outRate;
    return {
      app: row.app_name || 'unknown',
      mode: row.mode_used || '-',
      prompt,
      completion,
      cost,
    };
  });

  const totalCost = priced.reduce((sum, row) => sum + row.cost, 0);
  const totalPrompt = priced.reduce((sum, row) => sum + row.prompt, 0);
  const totalCompletion = priced.reduce((sum, row) => sum + row.completion, 0);

  return (
    <div className="w-full h-full flex flex-col bg-white/[0.03] border border-white/10 rounded p-2">
      <div className="flex items-center justify-between">
        <h4 className="text-[9px] uppercase tracking-widest text-white/55">Billing Daily</h4>
        <span className="text-[8px] text-white/35 font-mono">{day ?? new Date().toISOString().slice(0, 10)}</span>
      </div>

      <div className="mt-2 text-[8px] text-white/45 bg-[#2a2a2a] border border-white/10 rounded p-2">
        <div>gateway: {baseUrl ?? '-'}</div>
        <div>admin key: {adminKey ? 'bound' : 'missing'}</div>
        <div>rates: in={inRate} out={outRate}</div>
      </div>

      {missing_required_tags && missing_required_tags.length > 0 && (
        <div className="mt-2 p-1.5 rounded border border-amber-400/20 bg-amber-400/10 text-[9px] text-amber-200">
          Missing tags: {missing_required_tags.join(', ')}
        </div>
      )}

      <div className="mt-2 grid grid-cols-3 gap-2 text-[9px]">
        <div className="rounded bg-[#2a2a2a] border border-white/10 p-1.5">
          <div className="text-white/40">Prompt</div>
          <div className="text-white/85 font-mono">{totalPrompt}</div>
        </div>
        <div className="rounded bg-[#2a2a2a] border border-white/10 p-1.5">
          <div className="text-white/40">Completion</div>
          <div className="text-white/85 font-mono">{totalCompletion}</div>
        </div>
        <div className="rounded bg-[#2a2a2a] border border-white/10 p-1.5">
          <div className="text-white/40">Cost</div>
          <div className="text-emerald-300 font-mono">${totalCost.toFixed(4)}</div>
        </div>
      </div>

      <div className="mt-2 flex-1 min-h-0 overflow-auto space-y-1 pr-1">
        {usageDaily.isLoading && <div className="text-[10px] text-white/35">Loading usage...</div>}
        {usageDaily.isError && (
          <div className="text-[10px] text-red-300">Could not load daily usage.</div>
        )}
        {!usageDaily.isLoading && !usageDaily.isError && priced.length === 0 && (
          <div className="text-[10px] text-white/35">No usage rows for selected day.</div>
        )}
        {priced.map((row, idx) => (
          <div key={`${row.app}-${row.mode}-${idx}`} className="rounded bg-[#2a2a2a] border border-white/10 p-1.5">
            <div className="flex items-center justify-between text-[9px]">
              <span className="text-white/80 truncate">{row.app}</span>
              <span className="text-white/35 font-mono">{row.mode}</span>
            </div>
            <div className="mt-1 text-[8px] text-white/45 font-mono">
              p:{row.prompt} c:{row.completion} cost:${row.cost.toFixed(4)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
