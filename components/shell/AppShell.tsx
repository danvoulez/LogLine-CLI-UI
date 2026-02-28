'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/stores/ui-store';
import { usePanels, useCreatePanel, useDeletePanel, useRenamePanel, useAddComponent, useRemoveComponent } from '@/lib/api/db-hooks';
import { useDaemonHealth, useDaemonRuntimeStatus } from '@/lib/api/db-hooks';
import { ChevronLeft, ChevronRight, Settings, Activity, Home, Upload, FileText, Database, Cpu, ShoppingBag, Plus, Trash2, Search, Wifi, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ComponentStore } from '../component-catalog/ComponentStore';

export function AppShell({ children }: { children: React.ReactNode }) {
  // ── SQLite-backed data ─────────────────────────────────────────────────────
  const { data: panels = [], isLoading, isError, refetch: refetchPanels } = usePanels();
  const daemonHealth = useDaemonHealth();
  const daemonRuntimeStatus = useDaemonRuntimeStatus();
  const createPanel = useCreatePanel();
  const deletePanel  = useDeletePanel();
  const renamePanel = useRenamePanel();
  const addComponent = useAddComponent();
  const removeComponent = useRemoveComponent();

  // ── Ephemeral UI state ─────────────────────────────────────────────────────
  const {
    activePanelIndex,
    setActivePanelIndex,
    nextPanel,
    prevPanel,
    toggleAppSettings,
    isStoreOpen,
    toggleStore,
    storeSearch,
    setStoreSearch,
    storeFilter,
    setStoreFilter,
    selectedInstanceByPanel,
    globalStatus,
    wsConnected,
    setGlobalStatus,
    setWSConnected,
  } = useUIStore();

  const totalPanels = panels.length;
  const [editingPanelId, setEditingPanelId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isTrashOver, setIsTrashOver] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const [resolvedAppId] = useState(() => {
    if (typeof window === 'undefined') return 'ublx';
    return window.localStorage.getItem('ublx_app_id')?.trim() || 'ublx';
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  prevPanel();
      if (e.key === 'ArrowRight') nextPanel(totalPanels);
      if (e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1;
        if (index < totalPanels) setActivePanelIndex(index);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextPanel, prevPanel, totalPanels, setActivePanelIndex]);

  useEffect(() => {
    const healthOk = daemonHealth.data?.ok === true;
    setWSConnected(healthOk);

    if (!healthOk) {
      setGlobalStatus('offline', [{ name: 'logline-daemon', status: 'fail', latency_ms: 0 }]);
      return;
    }

    if (daemonRuntimeStatus.isError) {
      setGlobalStatus('degraded', [{ name: 'logline-daemon', status: 'warn', latency_ms: 0 }]);
      return;
    }

    setGlobalStatus('healthy', [{ name: 'logline-daemon', status: 'ok', latency_ms: 0 }]);
  }, [
    daemonHealth.data?.ok,
    daemonRuntimeStatus.isError,
    setGlobalStatus,
    setWSConnected,
  ]);

  const handleRemovePanel = (panelId: string) => {
    deletePanel.mutate(
      { panelId },
      { onSuccess: () => setActivePanelIndex(Math.max(0, activePanelIndex - 1)) }
    );
  };

  const parseDropped = (e: React.DragEvent) => {
    const componentId = e.dataTransfer.getData('application/x-logline-component-id');
    const instanceRaw = e.dataTransfer.getData('application/x-logline-instance');
    let instance: { panelId: string; instanceId: string; componentId?: string } | null = null;
    if (instanceRaw) {
      try {
        instance = JSON.parse(instanceRaw) as { panelId: string; instanceId: string; componentId?: string };
      } catch {
        instance = null;
      }
    }
    return { componentId: componentId || null, instance };
  };

  const handleDropToPanel = (panelId: string, e: React.DragEvent) => {
    e.preventDefault();
    const dropped = parseDropped(e);
    if (dropped.componentId) {
      addComponent.mutate({ panelId, componentId: dropped.componentId });
    }
  };

  const handleDropToTrash = (e: React.DragEvent) => {
    e.preventDefault();
    setIsTrashOver(false);
    const dropped = parseDropped(e);
    if (!dropped.instance) return;
    removeComponent.mutate({ panelId: dropped.instance.panelId, instanceId: dropped.instance.instanceId });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;

    // Horizontal swipe switches tabs on mobile.
    if (Math.abs(delta) < 44) return;
    if (delta > 0) {
      prevPanel();
    } else {
      nextPanel(totalPanels);
    }
  };

  const beginRename = (panelId: string, currentName: string) => {
    setEditingPanelId(panelId);
    setEditName(currentName);
  };

  const commitRename = () => {
    if (!editingPanelId) return;
    const next = editName.trim();
    if (!next) {
      setEditingPanelId(null);
      setEditName('');
      return;
    }

    renamePanel.mutate(
      { panelId: editingPanelId, name: next },
      {
        onSuccess: () => {
          setEditingPanelId(null);
          setEditName('');
        },
      }
    );
  };

  const statusColor = {
    healthy:  'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
    degraded: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
    offline:  'bg-red-500/10 border-red-500/20 text-red-300',
  }[globalStatus];

  const dotColor = {
    healthy:  'bg-emerald-500',
    degraded: 'bg-amber-500 animate-pulse',
    offline:  'bg-red-500',
  }[globalStatus];

  const icons = [Home, Activity, Upload, FileText, Database, Cpu, ShoppingBag];
  const activePanel = panels[activePanelIndex];
  const selectedInstanceId = activePanel
    ? (selectedInstanceByPanel[activePanel.panel_id] ?? activePanel.components?.[0]?.instance_id ?? '')
    : '';
  const selectedInstance = activePanel?.components?.find((c) => c.instance_id === selectedInstanceId);
  const selectedScope = typeof selectedInstance?.front_props?.app_scope === 'string'
    ? selectedInstance.front_props.app_scope
    : '';
  const scopeLabel = selectedScope || resolvedAppId || 'global';

  if (isLoading) {
    return (
      <div className="safe-app-frame flex w-full items-center justify-center bg-[var(--shell)]">
        <span className="text-white/20 text-xs font-mono animate-pulse tracking-widest uppercase">Loading...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="safe-app-frame flex flex-col gap-3 w-full items-center justify-center bg-[var(--shell)]">
        <span className="text-white/30 text-xs">Failed to load workspace</span>
        <button onClick={() => refetchPanels()} className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="safe-app-frame flex flex-col w-full bg-[var(--shell)] text-white overflow-hidden font-sans select-none">
      {/* Header */}
      <header className="h-11 md:h-9 flex items-center justify-between px-3 bg-[var(--shell)] z-50">
        <div className="w-1/3">
          <span className="text-[10px] font-medium text-white/30 tracking-wide">Workspace</span>
        </div>

        <div className="w-1/3 flex justify-center">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[14px] md:text-[15px] font-black tracking-tight text-white/95">UBLX</span>
            <span className="text-[11px] text-white/45">&gt;</span>
            <span className="text-[11px] md:text-[12px] font-semibold text-white/75 truncate max-w-[180px]">
              {scopeLabel}
            </span>
          </div>
        </div>

        <div className="w-1/3 flex justify-end">
          <button
            onClick={toggleAppSettings}
            className="p-1.5 hover:bg-white/5 rounded transition-all text-white/35 hover:text-white/60"
            title="App settings"
          >
            <Settings size={14} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative flex items-center justify-center overflow-hidden z-10 bg-[var(--shell)]">
        {/* Navigation Arrows */}
        <button
          onClick={prevPanel}
          disabled={activePanelIndex === 0}
          className="absolute left-2 z-40 hidden md:block p-2 bg-[#303030] hover:bg-[#363636] rounded disabled:opacity-0 transition-all border border-white/10 group"
        >
          <ChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform group-hover:text-blue-400" />
        </button>

        <button
          onClick={() => nextPanel(totalPanels)}
          disabled={activePanelIndex === totalPanels - 1}
          className="absolute right-2 z-40 hidden md:block p-2 bg-[#303030] hover:bg-[#363636] rounded disabled:opacity-0 transition-all border border-white/10 group"
        >
          <ChevronRight size={20} className="group-hover:translate-x-0.5 transition-transform group-hover:text-blue-400" />
        </button>

        {/* Panel Container */}
        <div className="w-full h-full p-1.5 flex items-center justify-center">
          <div
            className="w-full h-full"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const panel = panels[activePanelIndex];
              if (!panel) return;
              handleDropToPanel(panel.panel_id, e);
            }}
          >
            {children}
          </div>
        </div>

        {/* Store Overlay */}
        <AnimatePresence>
          {isStoreOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="absolute inset-0 md:inset-3 z-[100] bg-[#252525] border-0 md:border md:border-white/10 rounded-none md:rounded-xl overflow-hidden flex flex-col"
            >
              <div className="h-auto min-h-11 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between px-3 md:px-4 py-2 md:py-0 bg-[#2b2b2b] gap-2 md:gap-4">
                <div className="flex items-center gap-3 shrink-0">
                  <ShoppingBag size={15} className="text-white/60" />
                  <h2 className="text-xs font-semibold text-white/80">Components</h2>
                </div>

                <div className="flex-1 flex items-center gap-2 md:gap-3 max-w-2xl w-full">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
                    <input
                      type="text"
                      placeholder="Search components..."
                      value={storeSearch}
                      onChange={(e) => setStoreSearch(e.target.value)}
                    className="w-full bg-[#222] border border-white/10 rounded pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-white/25 transition-all"
                  />
                </div>
                  <div className="flex bg-[#232323] border border-white/10 rounded p-0.5 shrink-0">
                    {(['all', 'installed', 'available'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setStoreFilter(f)}
                        className={`px-2.5 md:px-3 py-1.5 md:py-1 rounded text-[8px] font-semibold uppercase tracking-wide transition-all ${
                          storeFilter === f ? 'bg-[#3a3a3a] text-white' : 'text-white/45 hover:text-white/70'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={toggleStore}
                  className="p-2 hover:bg-white/5 rounded text-white/20 hover:text-white transition-all shrink-0 self-end md:self-auto"
                >
                  <Plus size={20} className="rotate-45" />
                </button>
              </div>
              <div className="flex-1 p-3 md:p-4 overflow-hidden">
                <ComponentStore />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer / Tab Bar */}
      <footer className="flex flex-col md:flex-row md:h-11 bg-[var(--shell)] z-50 border-t border-white/5">
        {/* Tab bar row */}
        <div className="flex items-center h-11 px-2 md:px-4 gap-1 overflow-x-auto custom-scrollbar flex-1 min-w-0">
          {panels.map((panel, idx) => {
            const Icon = icons[idx % icons.length] || Home;
            const isActive = activePanelIndex === idx;
            return (
              <motion.div key={panel.panel_id} layout className="flex items-center gap-0.5 shrink-0">
                {editingPanelId === panel.panel_id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') {
                        setEditingPanelId(null);
                        setEditName('');
                      }
                    }}
                    className="px-2 py-1 rounded border border-white/20 bg-[#3a3a3a] text-[10px] font-medium text-white w-[90px] focus:outline-none"
                  />
                ) : (
                  <button
                    onClick={() => setActivePanelIndex(idx)}
                    onDoubleClick={() => beginRename(panel.panel_id, panel.name)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDropToPanel(panel.panel_id, e)}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded border transition-all ${
                      isActive
                        ? 'bg-[#3a3a3a] border-white/20 text-white'
                        : 'bg-transparent border-transparent text-white/30 hover:border-white/10 hover:text-white/70'
                    }`}
                    title="Double-click to rename"
                  >
                    <Icon size={12} />
                    <span className="text-[10px] font-medium whitespace-nowrap max-w-[64px] md:max-w-[80px] truncate">
                      {panel.name}
                    </span>
                  </button>
                )}
                {isActive && panels.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemovePanel(panel.panel_id); }}
                    disabled={deletePanel.isPending}
                    className="p-1 text-white/20 hover:text-red-300 transition-colors disabled:opacity-30"
                  >
                    <Trash2 size={10} />
                  </button>
                )}
              </motion.div>
            );
          })}

          <button
            onClick={() =>
              createPanel.mutate(
                { name: 'New Tab' },
                {
                  onSuccess: (created) => {
                    setActivePanelIndex(panels.length);
                    beginRename(created.panel_id, created.name);
                  },
                }
              )
            }
            disabled={createPanel.isPending}
            className="p-1.5 text-white/25 hover:text-white hover:bg-white/5 rounded transition-all shrink-0 disabled:opacity-30"
            title="Add Tab"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Toolbar row (mobile: full width, desktop: inline) */}
        <div className="flex items-center justify-between h-10 md:h-auto px-3 md:px-2 gap-2 border-t border-white/5 md:border-t-0 md:border-l md:border-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <div
              onDragOver={(e) => { e.preventDefault(); setIsTrashOver(true); }}
              onDragLeave={() => setIsTrashOver(false)}
              onDrop={handleDropToTrash}
              className={`p-1.5 rounded border transition-all ${
                isTrashOver
                  ? 'bg-red-500/20 border-red-400/40 text-red-200'
                  : 'bg-[#2c2c2c] border-white/10 text-white/35'
              }`}
              title="Drop component here to remove"
            >
              <Trash2 size={12} />
            </div>
            <button
              onClick={toggleStore}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[9px] font-semibold uppercase tracking-wide transition-all border ${
                isStoreOpen
                  ? 'bg-[#383838] border-white/20 text-white'
                  : 'bg-[#2c2c2c] border-white/10 text-white/40 hover:text-white/70 hover:border-white/20'
              }`}
            >
              <ShoppingBag size={12} />
              <span className="hidden sm:inline">Store</span>
            </button>
          </div>

          <div className={`flex items-center gap-1.5 px-2 py-1 border rounded text-[8px] uppercase tracking-wide font-semibold ${statusColor}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
            <span className="hidden sm:inline">{globalStatus}</span>
            {wsConnected ? (
              <Wifi size={10} className="text-cyan-400" />
            ) : (
              <WifiOff size={10} className="opacity-20" />
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
