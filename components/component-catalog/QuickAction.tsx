'use client';

import React from 'react';
import { Zap } from 'lucide-react';

interface QuickActionProps {
  label: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

export function QuickAction({ label, onClick, variant = 'primary', disabled = false }: QuickActionProps) {
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20',
    secondary: 'bg-white/5 hover:bg-white/10 text-white border border-white/10 shadow-black/20',
    danger: 'bg-red-500 hover:bg-red-400 text-white shadow-red-500/20',
  };

  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-2.5 px-4 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]}`}
    >
      <Zap size={12} />
      {label}
    </button>
  );
}
