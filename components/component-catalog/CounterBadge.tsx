'use client';

import React from 'react';

interface CounterBadgeProps {
  count: number;
  label: string;
  color?: 'emerald' | 'blue' | 'amber' | 'red';
}

export function CounterBadge({ count, label, color = 'emerald' }: CounterBadgeProps) {
  const colors = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${colors[color]}`}>
      <span className="text-xs font-bold">{count}</span>
      <span className="text-[9px] font-bold uppercase tracking-widest opacity-60">{label}</span>
    </div>
  );
}
