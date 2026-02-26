'use client';

import React from 'react';
import { Package, Trash2, Check, Info, Shield, Plus } from 'lucide-react';
import { MOCK_COMPONENTS } from '@/mocks/ublx-mocks';
import { ComponentManifest } from '@/types/ublx';
import { motion, AnimatePresence } from 'motion/react';

// Import components for preview
import { ServiceCard } from './ServiceCard';
import { DropZone } from './DropZone';
import { LLMStatus } from './LLMStatus';
import { QuickFiles } from './QuickFiles';
import { Registry } from './Registry';
import { PipelineEditor } from './PipelineEditor';
import { SmartList } from './SmartList';

import { useUIStore } from '@/stores/ui-store';
import { usePanels, useAddComponent, useRemoveComponent } from '@/lib/api/db-hooks';

export function ComponentStore() {
  const { activePanelIndex, storeSearch, storeFilter } = useUIStore();
  const { data: panels = [] } = usePanels();
  const addComponent    = useAddComponent();
  const removeComponent = useRemoveComponent();

  const activePanel = panels[activePanelIndex];
  const installedIdsInActivePanel = activePanel?.components?.map((c) => c.component_id) ?? [];

  const filteredComponents = MOCK_COMPONENTS.filter((comp) => {
    const matchesSearch =
      comp.name.toLowerCase().includes(storeSearch.toLowerCase()) ||
      comp.component_id.toLowerCase().includes(storeSearch.toLowerCase());
    const isInstalled = installedIdsInActivePanel.includes(comp.component_id);

    if (storeFilter === 'installed') return matchesSearch && isInstalled;
    if (storeFilter === 'available') return matchesSearch && !isInstalled;
    return matchesSearch;
  });

  const toggleInstall = (id: string) => {
    if (!activePanel) return;
    if (installedIdsInActivePanel.includes(id)) {
      const instance = activePanel.components?.find((c) => c.component_id === id);
      if (instance) {
        removeComponent.mutate({ panelId: activePanel.panel_id, instanceId: instance.instance_id });
      }
    } else {
      addComponent.mutate({ panelId: activePanel.panel_id, componentId: id });
    }
  };

  const renderPreview = (id: string) => {
    const previewProps = {
      'service-card': { title: 'Preview Service', status: 'ok' as const },
      'smart-list': {
        items: [
          { id: '1', label: 'Preview Item 1', value: 'Active',  status: 'ok'   as const },
          { id: '2', label: 'Preview Item 2', value: 'Pending', status: 'warn' as const },
        ],
      },
    };

    const wrap = (children: React.ReactNode) => (
      <div
        className="w-full h-full origin-top-left scale-[0.6] pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity"
        style={{ width: '166.66%', height: '166.66%' }}
      >
        {children}
      </div>
    );

    switch (id) {
      case 'service-card':    return wrap(<ServiceCard {...previewProps['service-card']} />);
      case 'drop-zone':       return wrap(<DropZone />);
      case 'llm-status':      return wrap(<LLMStatus />);
      case 'quick-files':     return wrap(<QuickFiles />);
      case 'registry':        return wrap(<Registry />);
      case 'pipeline-editor': return wrap(<PipelineEditor />);
      case 'smart-list':      return wrap(<SmartList {...previewProps['smart-list']} />);
      default:
        return (
          <div className="w-full h-full flex items-center justify-center bg-white/5 rounded border border-white/5">
            <Package size={24} className="text-white/10" />
          </div>
        );
    }
  };

  return (
    <div className="w-full h-full flex flex-col gap-4">
      {/* Component Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
        <div className="grid grid-cols-2 gap-3">
          <AnimatePresence mode="popLayout">
            {filteredComponents.map((comp) => {
              const isInstalled = installedIdsInActivePanel.includes(comp.component_id);
              const isPending   = addComponent.isPending || removeComponent.isPending;
              return (
                <motion.div
                  key={comp.component_id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  draggable
                  onDragStartCapture={(e: React.DragEvent<HTMLDivElement>) => {
                    e.dataTransfer.setData('application/x-logline-component-id', comp.component_id);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col gap-3 hover:border-blue-500/20 transition-all group relative overflow-hidden"
                >
                  <div className="flex items-start justify-between relative z-10">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isInstalled ? 'bg-blue-500/10 text-blue-400' : 'bg-white/5 text-white/20'}`}>
                        <Package size={18} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-white/90 group-hover:text-blue-400 transition-colors">{comp.name}</h4>
                        <p className="text-[8px] font-mono text-white/20 uppercase tracking-tighter mt-0.5">ID: {comp.component_id}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[8px] font-mono text-white/20 uppercase">v{comp.version}</span>
                      {isInstalled && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[7px] text-blue-400 font-black uppercase">
                          <Check size={8} /> On Tab
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Live Preview Area */}
                  <div className="h-24 w-full bg-black/40 rounded-lg border border-white/5 overflow-hidden relative group-hover:border-blue-500/30 transition-all">
                    {renderPreview(comp.component_id)}
                  </div>

                  <p className="text-[10px] text-white/40 line-clamp-2 leading-relaxed">
                    UBLX Native component for operational workflows. Supports source/processing manifests.
                  </p>

                  <div className="mt-auto pt-3 border-t border-white/5 flex items-center justify-between">
                    <div className="flex gap-1">
                      {comp.permissions.map((p) => (
                        <div key={p} className="p-1 bg-white/5 rounded text-white/20" title={p}>
                          <Shield size={10} />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button className="p-1.5 hover:bg-white/10 rounded text-white/20 hover:text-white transition-colors">
                        <Info size={14} />
                      </button>
                      {isInstalled ? (
                        <button
                          onClick={() => toggleInstall(comp.component_id)}
                          disabled={isPending}
                          className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-[9px] font-black uppercase tracking-widest text-red-400 transition-all disabled:opacity-40"
                        >
                          <Trash2 size={12} /> Remove
                        </button>
                      ) : (
                        <button
                          onClick={() => toggleInstall(comp.component_id)}
                          disabled={isPending}
                          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20 disabled:opacity-40"
                        >
                          <Plus size={12} /> Add to Tab
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
