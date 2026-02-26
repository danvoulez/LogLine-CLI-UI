'use client';

import React, { useState } from 'react';
import { Upload, File, Check, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function DropZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [step, setStep] = useState<'idle' | 'confirming' | 'processing' | 'done'>('idle');

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      setFiles(droppedFiles);
      setStep('confirming');
    }
  };

  const confirmUpload = () => {
    setStep('processing');
    setTimeout(() => setStep('done'), 2000);
  };

  return (
    <div className="w-full h-full flex flex-col">
      <AnimatePresence mode="wait">
        {step === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex-1 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-6 transition-all duration-300 ${
              isDragging 
                ? 'border-emerald-500 bg-emerald-500/[0.03] scale-[0.99] shadow-[inset_0_0_40px_rgba(16,185,129,0.05)]' 
                : 'border-white/5 bg-white/[0.02] hover:border-white/10'
            }`}
          >
            <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 ${
              isDragging ? 'bg-emerald-500 text-black shadow-[0_0_30px_rgba(16,185,129,0.4)]' : 'bg-white/5 text-white/20'
            }`}>
              <Upload size={32} className={isDragging ? 'animate-bounce' : ''} />
            </div>
            <div className="text-center">
              <p className="text-base font-black tracking-tight uppercase">Ingest Artifacts</p>
              <p className="text-[10px] text-white/20 mt-2 font-mono uppercase tracking-[0.3em]">Drag & Drop or Click to Browse</p>
            </div>
            
            {/* Hardware-style labels */}
            <div className="absolute bottom-6 left-6 flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-white/10 rounded-full" />
              <span className="text-[8px] font-mono text-white/10 uppercase tracking-widest">Ready for Ingest</span>
            </div>
          </motion.div>
        )}

        {step === 'confirming' && (
          <motion.div
            key="confirming"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            className="flex-1 bg-white/[0.02] border border-white/5 rounded-2xl p-8 flex flex-col hardware-border"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest">Confirm Batch</h3>
                  <p className="text-[9px] font-mono text-white/20 uppercase mt-0.5">Awaiting user authorization</p>
                </div>
              </div>
              <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] font-mono text-white/40">
                {files.length} ITEMS
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar mb-8 pr-2 flex flex-col gap-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-white/[0.03] rounded-xl border border-white/5 group hover:border-white/10 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-white/5 rounded text-white/20">
                      <File size={16} />
                    </div>
                    <div className="flex flex-col">
                      <p className="text-xs font-bold text-white/80 truncate max-w-[200px]">{f.name}</p>
                      <p className="text-[9px] font-mono text-white/20 uppercase">{(f.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <div className="w-1.5 h-1.5 bg-emerald-500/50 rounded-full" />
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setStep('idle')}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
              >
                Abort
              </button>
              <button 
                onClick={confirmUpload}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
              >
                Execute Pipeline
              </button>
            </div>
          </motion.div>
        )}

        {step === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col items-center justify-center gap-6"
          >
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full" />
              <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold tracking-tight">Processing Pipeline</p>
              <p className="text-[10px] text-white/40 mt-1 uppercase animate-pulse">Running UBLX Executor...</p>
            </div>
          </motion.div>
        )}

        {step === 'done' && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col items-center justify-center gap-4"
          >
            <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center text-black">
              <Check size={32} />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold">Operation Complete</p>
              <p className="text-[10px] text-white/40 mt-1">Files successfully ingested into Registry</p>
            </div>
            <button 
              onClick={() => setStep('idle')}
              className="mt-4 px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold"
            >
              DONE
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
