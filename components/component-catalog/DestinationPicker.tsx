'use client';

import React from 'react';
import { Server, Cloud, HardDrive, Share2 } from 'lucide-react';

export function DestinationPicker() {
  const destinations = [
    { id: 'local', label: 'Local Storage', icon: HardDrive, desc: '/data/ublx/vault' },
    { id: 'cloud', label: 'S3 Bucket', icon: Cloud, desc: 'ublx-prod-assets' },
    { id: 'registry', label: 'Gate Registry', icon: Server, desc: 'gate.local:8080' },
    { id: 'relay', label: 'Relay Node', icon: Share2, desc: 'relay-01.ublx.io' },
  ];

  const [selected, setSelected] = React.useState('local');

  return (
    <div className="space-y-3">
      <span className="text-[10px] font-bold uppercase text-white/40 tracking-widest">Target Destination</span>
      <div className="grid grid-cols-2 gap-2">
        {destinations.map((dest) => {
          const Icon = dest.icon;
          const isSelected = selected === dest.id;
          return (
            <button
              key={dest.id}
              onClick={() => setSelected(dest.id)}
              className={`flex flex-col gap-2 p-3 rounded-lg border transition-all text-left ${
                isSelected ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <Icon size={14} className={isSelected ? 'text-emerald-400' : 'text-white/40'} />
                {isSelected && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />}
              </div>
              <div>
                <p className={`text-[10px] font-bold uppercase ${isSelected ? 'text-emerald-400' : 'text-white/80'}`}>{dest.label}</p>
                <p className="text-[8px] text-white/40 truncate">{dest.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
