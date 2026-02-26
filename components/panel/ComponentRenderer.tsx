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
import { BillingDaily } from '../component-catalog/BillingDaily';

import { useEffectiveConfig, useRemoveComponent } from '@/lib/api/db-hooks';
import { Settings2, Trash2, Activity, MessageSquare, Shield, ListChecks, Package } from 'lucide-react';
import { useUIStore } from '@/stores/ui-store';
import { MOCK_COMPONENTS } from '@/mocks/ublx-mocks';

interface ComponentRendererProps {
  instance: PanelComponentInstance;
  panelId: string;
}

export function ComponentRenderer({ instance, panelId }: ComponentRendererProps) {
  const removeComponent = useRemoveComponent();
  const effectiveConfig = useEffectiveConfig(instance.instance_id);
  const selectedInstanceByPanel = useUIStore((state) => state.selectedInstanceByPanel);
  const setSelectedInstance = useUIStore((state) => state.setSelectedInstance);
  const toggleFlip = useUIStore((state) => state.toggleFlip);
  const isSelected = selectedInstanceByPanel[panelId] === instance.instance_id;
  const effective = effectiveConfig.data?.effective ?? {};
  const bindings = effectiveConfig.data?.bindings ?? {};
  const missingRequiredTags = effectiveConfig.data?.missing_required_tags ?? [];
  const manifest = MOCK_COMPONENTS.find((m) => m.component_id === instance.component_id);
  const title = manifest?.name ?? instance.component_id;

  const icon = (() => {
    switch (instance.component_id) {
      case 'chat-ai':
        return MessageSquare;
      case 'observability-hub':
        return Activity;
      case 'secret-field':
        return Shield;
      case 'billing-daily':
        return ListChecks;
      default:
        return Package;
    }
  })();

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
      case 'billing-daily':
        return (
          <BillingDaily
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
      } cursor-grab active:cursor-grabbing`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          'application/x-logline-instance',
          JSON.stringify({ panelId, instanceId: instance.instance_id, componentId: instance.component_id })
        );
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={() => setSelectedInstance(panelId, instance.instance_id)}
    >
      <div className="absolute left-2 right-2 top-2 z-40 flex items-center justify-between opacity-0 group-hover/comp:opacity-100 transition-opacity">
        <div className="inline-flex items-center gap-1.5 px-1.5 py-1 rounded bg-[#2b2b2b]/90 border border-white/10 text-white/70">
          {React.createElement(icon, { size: 11 })}
          <span className="text-[9px] font-medium truncate max-w-[120px]">{title}</span>
        </div>
        <div className="inline-flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedInstance(panelId, instance.instance_id);
              toggleFlip(panelId);
            }}
            className="p-1.5 bg-[#2f2f2f]/90 hover:bg-[#3a3a3a] rounded border border-white/10 text-white/60 hover:text-white/90"
            title="Settings"
          >
            <Settings2 size={11} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeComponent.mutate({ panelId, instanceId: instance.instance_id });
            }}
            disabled={removeComponent.isPending}
            className="p-1.5 bg-red-500/20 hover:bg-red-500 rounded border border-red-500/30 text-red-300 hover:text-white disabled:opacity-30"
            title="Remove component"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {renderComponent()}
    </div>
  );
}
