'use client';

import React from 'react';
import { PanelComponentInstance } from '@/types/ublx';
import { ServiceCard } from '../component-catalog/ServiceCard';
import { DropZone } from '../component-catalog/DropZone';
import { LLMStatus } from '../component-catalog/LLMStatus';
import { QuickFiles } from '../component-catalog/QuickFiles';
import { Registry } from '../component-catalog/Registry';
import { PipelineEditor } from '../component-catalog/PipelineEditor';
import { SmartList } from '../component-catalog/SmartList';
import { ComponentStore } from '../component-catalog/ComponentStore';

import { useRemoveComponent } from '@/lib/api/db-hooks';
import { Trash2 } from 'lucide-react';
import { useUIStore } from '@/stores/ui-store';

interface ComponentRendererProps {
  instance: PanelComponentInstance;
  panelId: string;
}

export function ComponentRenderer({ instance, panelId }: ComponentRendererProps) {
  const removeComponent = useRemoveComponent();
  const selectedInstanceByPanel = useUIStore((state) => state.selectedInstanceByPanel);
  const setSelectedInstance = useUIStore((state) => state.setSelectedInstance);
  const isSelected = selectedInstanceByPanel[panelId] === instance.instance_id;

  const renderComponent = () => {
    switch (instance.component_id) {
      case 'service-card':
        return <ServiceCard {...instance.front_props} />;
      case 'drop-zone':
        return <DropZone />;
      case 'llm-status':
        return <LLMStatus />;
      case 'quick-files':
        return <QuickFiles />;
      case 'registry':
        return <Registry />;
      case 'pipeline-editor':
        return <PipelineEditor />;
      case 'smart-list':
        return <SmartList items={instance.front_props?.items || []} />;
      case 'component-store':
        return <ComponentStore />;
      default:
        return (
          <div className="w-full h-full bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-center p-4 text-center">
            <p className="text-xs text-red-400">Component {instance.component_id} not found</p>
          </div>
        );
    }
  };

  return (
    <div
      className={`w-full h-full relative group/comp rounded-md ${
        isSelected ? 'ring-1 ring-white/35' : 'ring-1 ring-transparent hover:ring-white/15'
      }`}
      onClick={() => setSelectedInstance(panelId, instance.instance_id)}
    >
      {renderComponent()}

      {/* Quick Remove Button (only for non-store components) */}
      {instance.component_id !== 'component-store' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            removeComponent.mutate({ panelId, instanceId: instance.instance_id });
          }}
          disabled={removeComponent.isPending}
          className="absolute top-2 right-2 p-1.5 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white rounded-md opacity-0 group-hover/comp:opacity-100 transition-all z-50 border border-red-500/30 disabled:opacity-30"
          title="Remove component"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}
