'use client';

import React from 'react';
import { Search, Database, ShieldCheck, Send } from 'lucide-react';

export function Registry() {
  return (
    <div className="w-full h-full flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4">
        <button className="flex flex-col items-center justify-center gap-3 p-6 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all group">
          <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-400 group-hover:scale-110 transition-transform">
            <Send size={24} />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest">Submit Chip</span>
        </button>
        <button className="flex flex-col items-center justify-center gap-3 p-6 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all group">
          <div className="p-3 bg-blue-500/10 rounded-full text-blue-400 group-hover:scale-110 transition-transform">
            <ShieldCheck size={24} />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest">Verify Hash</span>
        </button>
      </div>

      <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={16} />
          <input 
            type="text" 
            placeholder="Search Registry (ID, Hash, Type)..."
            className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        <div className="flex-1 border border-white/5 rounded-lg bg-black/10 p-4 flex flex-col items-center justify-center text-center gap-3">
          <Database size={32} className="text-white/10" />
          <div>
            <p className="text-xs font-medium text-white/40">No active search results</p>
            <p className="text-[10px] text-white/20 mt-1 uppercase">Enter query to browse the Gate Registry</p>
          </div>
        </div>
      </div>
    </div>
  );
}
