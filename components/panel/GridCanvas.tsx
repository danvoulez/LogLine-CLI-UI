'use client';

import React from 'react';

interface GridCanvasProps {
  children: React.ReactNode;
  rows?: number;
  cols?: number;
}

export function GridCanvas24x32({ children, rows = 24, cols = 32 }: GridCanvasProps) {
  return (
    <div 
      className="relative w-full h-full grid gap-1"
      style={{
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
      }}
    >
      {/* Background Grid Lines (Optional for visual debug) */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02] grid gap-1"
           style={{
             gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
             gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
           }}>
        {Array.from({ length: rows * cols }).map((_, i) => (
          <div key={i} className="border border-white" />
        ))}
      </div>
      
      {children}
    </div>
  );
}

interface GridItemProps {
  x: number;
  y: number;
  w: number;
  h: number;
  children: React.ReactNode;
}

export function GridItem({ x, y, w, h, children }: GridItemProps) {
  return (
    <div 
      style={{
        gridRow: `${y + 1} / span ${h}`,
        gridColumn: `${x + 1} / span ${w}`,
      }}
      className="relative"
    >
      {children}
    </div>
  );
}
