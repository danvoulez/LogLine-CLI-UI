'use client';

import React from 'react';
import { MoreHorizontal } from 'lucide-react';

interface SmartListProps {
  items: Array<{ id: string; label: string; value: string; status?: 'ok' | 'warn' | 'fail' }>;
}

export function SmartList({ items }: SmartListProps) {
  return (
    <div className="w-full h-full flex flex-col gap-2">
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors group">
          <div className="flex items-center gap-3">
            <div className={`w-1.5 h-1.5 rounded-full ${
              item.status === 'ok' ? 'bg-emerald-500' : 
              item.status === 'warn' ? 'bg-amber-500' : 
              item.status === 'fail' ? 'bg-red-500' : 'bg-white/20'
            }`} />
            <div>
              <p className="text-xs font-bold">{item.label}</p>
              <p className="text-[9px] text-white/40 uppercase">{item.value}</p>
            </div>
          </div>
          <button className="p-1 hover:bg-white/10 rounded text-white/20 group-hover:text-white/60 transition-colors">
            <MoreHorizontal size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
