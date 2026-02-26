'use client';

import React from 'react';
import { File, MoreVertical, ExternalLink, Trash2 } from 'lucide-react';

export function QuickFiles() {
  const files = [
    { name: 'config_v1.json', size: '12KB', date: '2m ago' },
    { name: 'dataset_alpha.csv', size: '1.2MB', date: '15m ago' },
    { name: 'logs_20240224.txt', size: '45KB', date: '1h ago' },
    { name: 'schema_registry.yaml', size: '8KB', date: '3h ago' },
  ];

  return (
    <div className="w-full h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/40">Recent Artifacts</h4>
        <button className="text-[10px] font-bold text-emerald-400 hover:underline">VIEW ALL</button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2">
        {files.map((f, i) => (
          <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded border border-white/5 hover:border-white/10 transition-all group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/5 rounded text-white/40 group-hover:text-emerald-400 transition-colors">
                <File size={16} />
              </div>
              <div>
                <p className="text-xs font-bold">{f.name}</p>
                <p className="text-[9px] text-white/40 uppercase tracking-tighter">{f.size} • {f.date}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="p-1.5 hover:bg-white/10 rounded text-white/40 hover:text-white">
                <ExternalLink size={14} />
              </button>
              <button className="p-1.5 hover:bg-red-500/10 rounded text-white/40 hover:text-red-400">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
