'use client';

import React from 'react';
import { Cpu, Zap, Shield, Globe } from 'lucide-react';
import { useDaemonRuntimeStatus, useDaemonWhoami } from '@/lib/api/db-hooks';

export function LLMStatus() {
  const runtimeStatus = useDaemonRuntimeStatus();
  const whoami = useDaemonWhoami();

  const whoamiType =
    typeof whoami.data?.auth_type === 'string' ? (whoami.data.auth_type as string) : 'unknown';
  const runtimeMode = runtimeStatus.isSuccess ? 'ONLINE' : runtimeStatus.isLoading ? 'CHECKING' : 'OFFLINE';

  const providers = [
    { name: 'OpenAI', status: 'ok', latency: '120ms', model: 'gpt-4o', load: 45 },
    { name: 'Anthropic', status: 'ok', latency: '180ms', model: 'claude-3.5-sonnet', load: 12 },
    { name: 'Google', status: 'ok', latency: '95ms', model: 'gemini-1.5-pro', load: 88 },
    { name: 'Local (Llama)', status: 'warn', latency: '450ms', model: 'llama-3-8b', load: 95 },
  ];

  return (
    <div className="w-full h-full flex flex-col gap-3">
      {/* Header Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Mode', val: runtimeMode, color: 'text-blue-400', icon: Zap },
          { label: 'Auth', val: whoamiType.toUpperCase(), color: 'text-blue-400', icon: Shield },
          { label: 'Routing', val: 'DAEMON', color: 'text-white', icon: Globe },
          { label: 'Jobs', val: String(runtimeStatus.data?.running_jobs ?? 0), color: 'text-white', icon: Cpu },
        ].map((stat, i) => (
          <div key={i} className="bg-white/[0.03] border border-white/5 rounded-lg p-2 flex flex-col gap-1 hardware-border">
            <div className="flex items-center justify-between text-white/20">
              <stat.icon size={10} />
              <span className="text-[7px] font-black uppercase tracking-[0.1em]">{stat.label}</span>
            </div>
            <span className={`text-[10px] font-black tracking-tight ${stat.color}`}>{stat.val}</span>
          </div>
        ))}
      </div>

      {/* Provider Matrix */}
      <div className="flex-1 bg-white/[0.02] border border-white/5 rounded-xl p-3 flex flex-col hardware-border overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-[8px] font-black uppercase tracking-[0.2em] text-white/30">Matrix</h4>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="w-1 h-1 bg-emerald-500 rounded-full" />
              <span className="text-[7px] font-mono text-white/20 uppercase">OK</span>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-1.5">
          {providers.map((p, i) => (
            <div key={i} className="flex items-center justify-between p-2 bg-white/[0.03] rounded-lg border border-white/5 hover:border-blue-500/20 transition-all group cursor-pointer">
              <div className="flex items-center gap-2">
                <div className={`w-1 h-1 rounded-full ${p.status === 'ok' ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.5)]'}`} />
                <div>
                  <p className="text-[10px] font-black text-white/90 group-hover:text-blue-400 transition-colors">{p.name}</p>
                  <p className="text-[7px] font-mono text-white/20 uppercase tracking-tighter">{p.model}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="w-16 hidden sm:block">
                  <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${p.load > 80 ? 'bg-amber-500' : 'bg-blue-500/50'}`}
                      style={{ width: `${p.load}%` }}
                    />
                  </div>
                </div>
                <div className="text-right min-w-[40px]">
                  <p className="text-[9px] font-mono font-bold text-white/70">{p.latency}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
