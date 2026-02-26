'use client';

import React from 'react';
import { Play, Square, RefreshCcw, Terminal } from 'lucide-react';

export function PipelineEditor() {
  return (
    <div className="w-full h-full bg-black/40 border border-white/10 rounded-xl overflow-hidden flex flex-col">
      <div className="h-10 border-b border-white/10 bg-white/5 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-white/40" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Pipeline: ingest_v2</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-1.5 hover:bg-emerald-500/20 rounded text-emerald-400 transition-colors">
            <Play size={14} />
          </button>
          <button className="p-1.5 hover:bg-red-500/20 rounded text-red-400 transition-colors">
            <Square size={14} />
          </button>
          <button className="p-1.5 hover:bg-white/10 rounded text-white/40 transition-colors">
            <RefreshCcw size={14} />
          </button>
        </div>
      </div>
      
      <div className="flex-1 p-4 font-mono text-xs text-emerald-500/80 overflow-y-auto custom-scrollbar">
        <div className="flex gap-4">
          <span className="text-white/20 select-none">01</span>
          <span>LOAD_SOURCE &quot;gate_registry&quot;</span>
        </div>
        <div className="flex gap-4">
          <span className="text-white/20 select-none">02</span>
          <span>EXTRACT_METADATA --strict</span>
        </div>
        <div className="flex gap-4">
          <span className="text-white/20 select-none">03</span>
          <span>VALIDATE_CHIP_HASH $SRC.hash</span>
        </div>
        <div className="flex gap-4">
          <span className="text-white/20 select-none">04</span>
          <span className="text-white/40 italic"># Processing via UBLX executor</span>
        </div>
        <div className="flex gap-4">
          <span className="text-white/20 select-none">05</span>
          <span>TRANSFORM_TO_JSON --pretty</span>
        </div>
        <div className="flex gap-4">
          <span className="text-white/20 select-none">06</span>
          <span className="animate-pulse">_</span>
        </div>
      </div>

      <div className="h-8 bg-emerald-500/5 border-t border-white/5 flex items-center px-4">
        <span className="text-[9px] font-bold text-emerald-500/60 uppercase tracking-tighter">Status: Idle • Ready for execution</span>
      </div>
    </div>
  );
}
