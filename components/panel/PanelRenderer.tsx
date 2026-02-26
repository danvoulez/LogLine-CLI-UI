'use client';

import React from 'react';
import { PanelManifest } from '@/types/ublx';
import { GridCanvas24x32, GridItem } from './GridCanvas';
import { ComponentRenderer } from './ComponentRenderer';
import { Plus } from 'lucide-react';

interface PanelRendererProps {
  manifest: PanelManifest;
}

export function PanelRenderer({ manifest }: PanelRendererProps) {
  return (
    <div className="w-full h-full flex flex-col">
      <div className="mb-2 flex items-center justify-end">
        <div className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[8px] font-medium text-white/30">
          {manifest.name}
        </div>
      </div>
      
      <div className="flex-1 relative">
        {manifest.components.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center border border-white/10 rounded-lg bg-white/[0.02]">
            <div className="w-10 h-10 bg-white/5 rounded flex items-center justify-center mb-3">
              <Plus size={24} className="text-white/20" />
            </div>
            <p className="text-xs font-medium text-white/45">No components yet</p>
            <p className="text-[10px] text-white/25 mt-1">Open Store to add widgets</p>
          </div>
        ) : (
          <GridCanvas24x32>
            {manifest.components.map((comp) => (
              <GridItem key={comp.instance_id} {...comp.rect}>
                <ComponentRenderer instance={comp} panelId={manifest.panel_id} />
              </GridItem>
            ))}
          </GridCanvas24x32>
        )}
      </div>
    </div>
  );
}
