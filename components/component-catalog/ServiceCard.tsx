'use client';

import React from 'react';
import { Activity, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

interface ServiceCardProps {
  title?: string;
  status?: 'ok' | 'warn' | 'fail';
  type?: 'card' | 'list';
}

export function ServiceCard({ title = 'Service', status = 'ok', type = 'card' }: ServiceCardProps) {
  const statusColors = {
    ok: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    warn: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    fail: 'text-red-400 bg-red-500/10 border-red-500/20',
  };

  const StatusIcon = {
    ok: CheckCircle2,
    warn: AlertCircle,
    fail: XCircle,
  }[status];

  if (type === 'list') {
    return (
      <div className="w-full h-full bg-white/[0.02] border border-white/5 rounded-lg p-3 flex flex-col gap-2 overflow-y-auto custom-scrollbar hardware-border">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-[8px] font-black uppercase tracking-[0.2em] text-white/30">{title}</h4>
          <span className="text-[8px] font-mono text-emerald-500/50">LIVE</span>
        </div>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center justify-between p-2 bg-white/[0.03] rounded border border-white/5 hover:border-blue-500/20 transition-all group cursor-pointer">
            <div className="flex items-center gap-2">
              <Activity size={12} className="text-white/20 group-hover:text-blue-400 transition-colors" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-white/80 group-hover:text-blue-400 transition-colors">Node 0{i}</span>
              </div>
            </div>
            <div className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest ${statusColors.ok}`}>
              OK
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-white/[0.02] border border-white/5 rounded-lg p-3 flex flex-col justify-between group hover:border-blue-500/20 transition-all cursor-pointer relative overflow-hidden">
      <div className="flex items-center justify-between relative z-10">
        <div className="p-1.5 bg-white/5 rounded border border-white/5 group-hover:border-blue-500/30 transition-all">
          <Activity size={16} className={status === 'ok' ? 'text-emerald-400' : 'text-amber-400'} />
        </div>
        <div className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest ${statusColors[status]} shadow-sm glow-emerald`}>
          {status}
        </div>
      </div>
      
      <div className="relative z-10">
        <h3 className="text-[11px] font-bold text-white/90 tracking-tight truncate group-hover:text-blue-400 transition-colors">{title}</h3>
        <div className="flex items-center gap-1.5 mt-1.5">
          <div className="flex-1 h-[1.5px] bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 w-[85%] animate-pulse" />
          </div>
          <span className="text-[8px] font-mono text-white/30">85%</span>
        </div>
      </div>
    </div>
  );
}
