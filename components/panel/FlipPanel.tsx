'use client';

import React from 'react';
import { motion } from 'motion/react';
import { useUIStore } from '@/stores/ui-store';
import { RotateCw } from 'lucide-react';

interface FlipPanelProps {
  panelId: string;
  front: React.ReactNode;
  back: React.ReactNode;
}

export function FlipPanel({ panelId, front, back }: FlipPanelProps) {
  const isFlipped = useUIStore((state) => state.flippedPanels[panelId] || false);
  const toggleFlip = useUIStore((state) => state.toggleFlip);

  return (
    <div className="relative w-full h-full perspective-1000">
      <motion.div
        className="relative w-full h-full transition-all duration-500 preserve-3d"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
      >
        {/* Front Side */}
        <div className="absolute inset-0 w-full h-full backface-hidden bg-[#2b2b2b] border border-white/10 rounded-lg overflow-hidden">
          <div className="absolute top-3 right-3 z-50">
            <button 
              onClick={() => toggleFlip(panelId)}
              className="p-1.5 bg-[#323232] hover:bg-[#3a3a3a] rounded border border-white/10 transition-all text-white/40 hover:text-white/70 hover:scale-105 active:scale-95"
            >
              <RotateCw size={12} />
            </button>
          </div>
          <div className="w-full h-full p-4">
            {front}
          </div>
        </div>

        {/* Back Side */}
        <div 
          className="absolute inset-0 w-full h-full backface-hidden bg-[#2e2e2e] border border-white/10 rounded-lg overflow-hidden"
          style={{ transform: 'rotateY(180deg)' }}
        >
          <div className="absolute top-3 right-3 z-50">
            <button 
              onClick={() => toggleFlip(panelId)}
              className="p-1.5 bg-[#363636] hover:bg-[#404040] rounded border border-white/10 transition-all text-white/60 hover:scale-105 active:scale-95"
            >
              <RotateCw size={12} />
            </button>
          </div>
          <div className="w-full h-full p-4">
            <div className="flex flex-col h-full">
              <div className="mb-3 pb-2 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-[10px] font-semibold tracking-wide text-white/70">Settings</h3>
                <span className="text-[8px] font-mono text-white/20">ID: {panelId}</span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                {back}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
