'use client';

import React from 'react';
import { PanelManifest } from '@/types/ublx';
import { ComponentRenderer } from './ComponentRenderer';
import { Plus } from 'lucide-react';
import { mobilePriorityRank, TemplateSize, resolveTemplateContract } from '@/lib/config/component-template';

interface PanelRendererProps {
  manifest: PanelManifest;
}

function resolveTemplateSize(componentId: string, frontProps?: Record<string, unknown>): TemplateSize {
  return resolveTemplateContract(componentId, frontProps).template_size;
}

function slotClass(size: TemplateSize): string {
  if (size === 'unit') return 'component-slot slot--unit';
  if (size === 'block') return 'component-slot slot--block';
  return 'component-slot slot--line';
}

export function PanelRenderer({ manifest }: PanelRendererProps) {
  return (
    <div className="w-full h-full panel-stage">
      <div className="h-full relative overflow-auto rounded-lg bg-transparent border border-transparent">
        {manifest.components.length === 0 ? (
          <div className="w-full h-full min-h-[360px] flex flex-col items-center justify-center">
            <div className="w-10 h-10 bg-white/5 rounded flex items-center justify-center mb-3">
              <Plus size={24} className="text-white/20" />
            </div>
            <p className="text-xs font-medium text-white/45">No components yet</p>
            <p className="text-[10px] text-white/25 mt-1">Open Store</p>
          </div>
        ) : (
          <div className="panel-canvas">
            <div className="component-layout-grid">
              {[...manifest.components]
                .sort((a, b) => {
                  const aContract = resolveTemplateContract(a.component_id, (a.front_props ?? {}) as Record<string, unknown>);
                  const bContract = resolveTemplateContract(b.component_id, (b.front_props ?? {}) as Record<string, unknown>);
                  const priorityDelta = mobilePriorityRank(aContract.mobile_priority) - mobilePriorityRank(bContract.mobile_priority);
                  if (priorityDelta !== 0) return priorityDelta;
                  return a.instance_id.localeCompare(b.instance_id);
                })
                .map((comp) => {
                const size = resolveTemplateSize(
                  comp.component_id,
                  (comp.front_props as Record<string, unknown> | undefined) ?? undefined
                );
                const contract = resolveTemplateContract(
                  comp.component_id,
                  (comp.front_props as Record<string, unknown> | undefined) ?? undefined
                );
                const priorityClass = `priority--${contract.mobile_priority}`;

                return (
                  <div key={comp.instance_id} className={`${slotClass(size)} ${priorityClass}`}>
                    <ComponentRenderer instance={comp} panelId={manifest.panel_id} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
