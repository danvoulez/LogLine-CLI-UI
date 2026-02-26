'use client';

import React from 'react';
import { Eye, EyeOff, Lock, Copy } from 'lucide-react';

interface SecretFieldProps {
  label: string;
  value: string;
}

export function SecretField({ label, value }: SecretFieldProps) {
  const [show, setShow] = React.useState(false);

  return (
    <div className="space-y-1.5">
      <span className="text-[10px] font-bold uppercase text-white/40 tracking-widest">{label}</span>
      <div className="relative group">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20">
          <Lock size={14} />
        </div>
        <input 
          type={show ? 'text' : 'password'} 
          readOnly
          value={value}
          className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-20 py-2 text-xs font-mono text-white/80 focus:outline-none"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <button 
            onClick={() => setShow(!show)}
            className="p-1.5 hover:bg-white/10 rounded text-white/40 hover:text-white transition-colors"
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button 
            onClick={() => navigator.clipboard.writeText(value)}
            className="p-1.5 hover:bg-white/10 rounded text-white/40 hover:text-white transition-colors"
          >
            <Copy size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
