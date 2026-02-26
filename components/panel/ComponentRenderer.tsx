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
import { ChatAI } from '../component-catalog/ChatAI';
import { SecretField } from '../component-catalog/SecretField';
import { ObservabilityHub } from '../component-catalog/ObservabilityHub';

import { useEffectiveConfig, useRemoveComponent } from '@/lib/api/db-hooks';
import { Trash2 } from 'lucide-react';
import { useUIStore } from '@/stores/ui-store';

interface ComponentRendererProps {
  instance: PanelComponentInstance;
  panelId: string;
}

export function ComponentRenderer({ instance, panelId }: ComponentRendererProps) {
  const removeComponent = useRemoveComponent();
  const effectiveConfig = useEffectiveConfig(instance.instance_id);
  const selectedInstanceByPanel = useUIStore((state) => state.selectedInstanceByPanel);
  const setSelectedInstance = useUIStore((state) => state.setSelectedInstance);
  const isSelected = selectedInstanceByPanel[panelId] === instance.instance_id;
  const effective = effectiveConfig.data?.effective ?? {};
  const bindings = effectiveConfig.data?.bindings ?? {};
  const missingRequiredTags = effectiveConfig.data?.missing_required_tags ?? [];

  const renderComponent = () => {
    switch (instance.component_id) {
      case 'service-card':
        return (
          <ServiceCard
            title={
              typeof effective.service_title === 'string'
                ? effective.service_title
                : typeof instance.front_props?.title === 'string'
                  ? instance.front_props.title
                  : undefined
            }
            status={
              effective.service_status === 'ok' || effective.service_status === 'warn' || effective.service_status === 'fail'
                ? effective.service_status
                : instance.front_props?.status === 'ok' || instance.front_props?.status === 'warn' || instance.front_props?.status === 'fail'
                  ? instance.front_props.status
                  : undefined
            }
            type={
              effective.service_type === 'card' || effective.service_type === 'list'
                ? effective.service_type
                : instance.front_props?.type === 'card' || instance.front_props?.type === 'list'
                  ? instance.front_props.type
                  : undefined
            }
          />
        );
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
      case 'chat-ai':
        return (
          <ChatAI
            session_id={typeof instance.front_props?.session_id === 'string' ? instance.front_props.session_id : undefined}
            panel_id={panelId}
            instance_id={instance.instance_id}
            effective={effective}
            bindings={bindings}
            missing_required_tags={missingRequiredTags}
          />
        );
      case 'secret-field':
        return (
          <SecretField
            label={
              typeof effective.secret_label === 'string'
                ? effective.secret_label
                : typeof instance.front_props?.label === 'string'
                  ? instance.front_props.label
                  : 'Secret'
            }
            value={
              typeof effective.secret_value === 'string'
                ? effective.secret_value
                : typeof instance.front_props?.value === 'string'
                  ? instance.front_props.value
                  : '••••••••'
            }
          />
        );
      case 'observability-hub':
        return (
          <ObservabilityHub
            effective={effective}
            bindings={bindings}
            missing_required_tags={missingRequiredTags}
          />
        );
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
