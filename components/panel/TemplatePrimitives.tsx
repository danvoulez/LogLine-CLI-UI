'use client';

import React from 'react';

type HealthState = 'ok' | 'not_ok';
type InfoTone = 'blue' | 'purple' | 'orange';

export function TemplateHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="pr-6">
      <p className="text-[10px] uppercase tracking-wide text-white/45">{title}</p>
      <p className="text-[11px] text-white/70">{subtitle}</p>
    </div>
  );
}

export function TemplateIndicators({ health, infoTone }: { health: HealthState; infoTone: InfoTone }) {
  const infoColorClass = {
    blue: 'text-blue-300 border-blue-400/30 bg-blue-500/10',
    purple: 'text-violet-300 border-violet-400/30 bg-violet-500/10',
    orange: 'text-orange-300 border-orange-400/30 bg-orange-500/10',
  }[infoTone];

  const healthColorClass =
    health === 'ok'
      ? 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10'
      : 'text-red-300 border-red-400/30 bg-red-500/10';

  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 ${healthColorClass}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {health === 'ok' ? 'OK' : 'NOT OK'}
      </span>
      <span className={`rounded border px-1.5 py-0.5 ${infoColorClass}`}>{infoTone.toUpperCase()}</span>
    </div>
  );
}

export function UnitPrimitive({ label }: { label: string }) {
  return (
    <div className="h-8 w-full rounded border border-white/10 bg-white/[0.03] px-2 flex items-center justify-center text-[10px] text-white/65">
      {label}
    </div>
  );
}

export function LinePrimitive({ labelLeft, labelRight }: { labelLeft: string; labelRight: string }) {
  return (
    <div className="h-8 w-full rounded border border-white/10 bg-white/[0.03] px-2 flex items-center justify-between text-[10px] text-white/60">
      <span>{labelLeft}</span>
      <span className="text-white/45">{labelRight}</span>
    </div>
  );
}

export function BlockPrimitive({ title, body }: { title: string; body: string }) {
  return (
    <div className="w-full min-h-16 rounded border border-white/10 bg-white/[0.03] p-2 flex flex-col justify-between">
      <p className="text-[10px] text-white/75">{title}</p>
      <p className="text-[10px] text-white/50">{body}</p>
    </div>
  );
}
