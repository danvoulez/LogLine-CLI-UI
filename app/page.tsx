'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useUIStore } from '@/stores/ui-store';
import {
  usePanels,
  usePanelSettings,
  useSavePanelSettings,
  useInstanceConfig,
  useEffectiveConfig,
  useSaveInstanceConfig,
} from '@/lib/api/db-hooks';
import { AppShell } from '@/components/shell/AppShell';
import { FlipPanel } from '@/components/panel/FlipPanel';
import { PanelRenderer } from '@/components/panel/PanelRenderer';
import { motion, AnimatePresence } from 'motion/react';
import { QuickAction } from '@/components/component-catalog/QuickAction';

type ErrorMode = 'RETRY' | 'STOP' | 'CONTINUE';

const SOURCE_HUB_OPTIONS = ['WebSocket', 'HTTP API', 'File Watch', 'Internal Bus'] as const;

function asErrorMode(value: unknown, fallback: ErrorMode): ErrorMode {
  return value === 'RETRY' || value === 'STOP' || value === 'CONTINUE' ? value : fallback;
}

function BackSettingsPanel({
  panelName,
  selectedComponentId,
  hasSelectedComponent,
  initialTabSourceHub,
  initialTabErrorMode,
  initialComponentCommand,
  initialComponentErrorMode,
  effectivePreview,
  isSavingTab,
  isSavingComponent,
  savedKey,
  onSaveTab,
  onSaveComponent,
}: {
  panelName: string;
  selectedComponentId: string | null;
  hasSelectedComponent: boolean;
  initialTabSourceHub: string;
  initialTabErrorMode: ErrorMode;
  initialComponentCommand: string;
  initialComponentErrorMode: ErrorMode;
  effectivePreview: {
    source_hub: string;
    proc_executor: string;
    proc_error_mode: string;
  };
  isSavingTab: boolean;
  isSavingComponent: boolean;
  savedKey: 'tab' | 'component' | null;
  onSaveTab: (draft: { source_hub: string; proc_error_mode: ErrorMode }) => void;
  onSaveComponent: (draft: { proc_command: string; proc_error_mode: ErrorMode }) => void;
}) {
  const [tabSourceHub, setTabSourceHub] = useState(initialTabSourceHub);
  const [tabErrorMode, setTabErrorMode] = useState<ErrorMode>(initialTabErrorMode);
  const [componentCommand, setComponentCommand] = useState(initialComponentCommand);
  const [componentErrorMode, setComponentErrorMode] = useState<ErrorMode>(initialComponentErrorMode);

  return (
    <div className="space-y-5 text-white/80">
      <section className="space-y-3 border border-white/10 bg-[#323232] rounded p-3">
        <div className="flex items-center justify-between">
          <h4 className="text-[10px] font-semibold tracking-wide text-white/70">Tab Defaults</h4>
          <span className="text-[8px] font-mono text-white/35">{panelName}</span>
        </div>

        <label className="block">
          <span className="text-[10px] text-white/45 mb-1 block">Source Hub</span>
          <select
            value={tabSourceHub}
            onChange={(e) => setTabSourceHub(e.target.value)}
            className="w-full bg-[#2a2a2a] border border-white/10 rounded px-2.5 py-2 text-xs focus:outline-none focus:border-white/30"
          >
            {SOURCE_HUB_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center justify-between p-2.5 bg-[#2a2a2a] rounded border border-white/10">
          <span className="text-xs font-medium">Error Mode</span>
          <div className="flex gap-1">
            {(['RETRY', 'STOP', 'CONTINUE'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setTabErrorMode(mode)}
                className={`px-2 py-1 text-[9px] rounded border ${
                  tabErrorMode === mode
                    ? 'bg-[#3c3c3c] text-white border-white/20'
                    : 'bg-[#2f2f2f] text-white/40 border-white/10'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <QuickAction
          label={savedKey === 'tab' ? 'TAB SAVED' : isSavingTab ? 'SAVING...' : 'SAVE TAB DEFAULTS'}
          onClick={() => onSaveTab({ source_hub: tabSourceHub, proc_error_mode: tabErrorMode })}
          variant="secondary"
        />
      </section>

      <section className="space-y-3 border border-white/10 bg-[#323232] rounded p-3">
        <div className="flex items-center justify-between">
          <h4 className="text-[10px] font-semibold tracking-wide text-white/70">Component Override</h4>
          <span className="text-[8px] font-mono text-white/35 truncate max-w-[180px]">
            {selectedComponentId ?? 'No component selected'}
          </span>
        </div>

        {!hasSelectedComponent ? (
          <div className="text-[11px] text-white/45 border border-white/10 rounded p-3 bg-[#2b2b2b]">
            Select a component on the panel to edit instance-level overrides.
          </div>
        ) : (
          <>
            <label className="block">
              <span className="text-[10px] text-white/45 mb-1 block">Base Command</span>
              <input
                type="text"
                value={componentCommand}
                onChange={(e) => setComponentCommand(e.target.value)}
                placeholder="process --input $SRC"
                className="w-full bg-[#2a2a2a] border border-white/10 rounded px-2.5 py-2 text-xs focus:outline-none focus:border-white/30"
              />
            </label>

            <div className="flex items-center justify-between p-2.5 bg-[#2a2a2a] rounded border border-white/10">
              <span className="text-xs font-medium">Error Mode</span>
              <div className="flex gap-1">
                {(['RETRY', 'STOP', 'CONTINUE'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setComponentErrorMode(mode)}
                    className={`px-2 py-1 text-[9px] rounded border ${
                      componentErrorMode === mode
                        ? 'bg-[#3c3c3c] text-white border-white/20'
                        : 'bg-[#2f2f2f] text-white/40 border-white/10'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-[10px] border border-white/10 rounded p-2.5 bg-[#2a2a2a] space-y-1">
              <div className="text-white/55">Effective Preview</div>
              <div className="text-white/35 font-mono">source_hub: {effectivePreview.source_hub}</div>
              <div className="text-white/35 font-mono">proc_executor: {effectivePreview.proc_executor}</div>
              <div className="text-white/35 font-mono">proc_error_mode: {effectivePreview.proc_error_mode}</div>
            </div>

            <QuickAction
              label={
                savedKey === 'component'
                  ? 'COMPONENT SAVED'
                  : isSavingComponent
                    ? 'SAVING...'
                    : 'SAVE COMPONENT OVERRIDE'
              }
              onClick={() =>
                onSaveComponent({ proc_command: componentCommand, proc_error_mode: componentErrorMode })
              }
              variant="secondary"
            />
          </>
        )}
      </section>
    </div>
  );
}

export default function Page() {
  const { activePanelIndex, selectedInstanceByPanel, setSelectedInstance } = useUIStore();
  const { data: panels = [] } = usePanels();
  const savePanelSettings = useSavePanelSettings();
  const saveInstanceConfig = useSaveInstanceConfig();

  const [savedKey, setSavedKey] = useState<'tab' | 'component' | null>(null);

  const activePanel = panels[activePanelIndex];
  const selectedInstanceId = activePanel
    ? (selectedInstanceByPanel[activePanel.panel_id] ?? activePanel.components?.[0]?.instance_id ?? '')
    : '';
  const selectedInstance = useMemo(
    () => activePanel?.components.find((c) => c.instance_id === selectedInstanceId) ?? null,
    [activePanel, selectedInstanceId]
  );

  const panelSettings = usePanelSettings(activePanel?.panel_id ?? '');
  const instanceConfig = useInstanceConfig(selectedInstanceId);
  const effectiveConfig = useEffectiveConfig(selectedInstanceId);

  useEffect(() => {
    if (!activePanel || activePanel.components.length === 0) return;
    if (!selectedInstanceByPanel[activePanel.panel_id]) {
      setSelectedInstance(activePanel.panel_id, activePanel.components[0].instance_id);
    }
  }, [activePanel, selectedInstanceByPanel, setSelectedInstance]);

  const showSaved = (key: 'tab' | 'component') => {
    setSavedKey(key);
    setTimeout(() => setSavedKey(null), 1800);
  };

  const handleSaveTabSettings = (draft: { source_hub: string; proc_error_mode: ErrorMode }) => {
    if (!activePanel) return;
    savePanelSettings.mutate(
      {
        panelId: activePanel.panel_id,
        settings: {
          source_hub: draft.source_hub,
          proc_executor: 'UBLX_NATIVE_V1',
          proc_error_mode: draft.proc_error_mode,
        },
      },
      { onSuccess: () => showSaved('tab') }
    );
  };

  const handleSaveComponent = (draft: { proc_command: string; proc_error_mode: ErrorMode }) => {
    if (!selectedInstance) return;

    const base = (instanceConfig.data ?? {}) as Record<string, unknown>;
    const parsedProcArgs = Array.isArray(base.proc_args) ? (base.proc_args as string[]) : [];

    saveInstanceConfig.mutate(
      {
        instanceId: selectedInstance.instance_id,
        config: {
          source_hub: typeof base.source_hub === 'string' ? base.source_hub : null,
          source_origin: typeof base.source_origin === 'string' ? base.source_origin : null,
          source_auth_ref: typeof base.source_auth_ref === 'string' ? base.source_auth_ref : null,
          source_mode: typeof base.source_mode === 'string' ? base.source_mode : null,
          source_interval_ms: typeof base.source_interval_ms === 'number' ? base.source_interval_ms : null,
          proc_executor: typeof base.proc_executor === 'string' ? base.proc_executor : 'UBLX_NATIVE_V1',
          proc_command: draft.proc_command,
          proc_args: parsedProcArgs,
          proc_timeout_ms: typeof base.proc_timeout_ms === 'number' ? base.proc_timeout_ms : null,
          proc_retries: typeof base.proc_retries === 'number' ? base.proc_retries : null,
          proc_backoff: typeof base.proc_backoff === 'string' ? base.proc_backoff : null,
          proc_error_mode: draft.proc_error_mode,
        },
      },
      { onSuccess: () => showSaved('component') }
    );
  };

  if (!activePanel) return null;

  const panelSettingsData = panelSettings.data?.settings ?? {};
  const effectiveData = effectiveConfig.data?.effective ?? {};

  const settingsKey = [
    activePanel.panel_id,
    panelSettings.dataUpdatedAt,
    selectedInstance?.instance_id ?? 'none',
    effectiveConfig.dataUpdatedAt,
  ].join(':');

  return (
    <AppShell>
      <div className="w-full h-full relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activePanel.panel_id}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="w-full h-full"
          >
            <FlipPanel
              panelId={activePanel.panel_id}
              front={<PanelRenderer manifest={activePanel} />}
              back={
                <BackSettingsPanel
                  key={settingsKey}
                  panelName={activePanel.name}
                  selectedComponentId={selectedInstance?.component_id ?? null}
                  hasSelectedComponent={!!selectedInstance}
                  initialTabSourceHub={
                    typeof panelSettingsData.source_hub === 'string'
                      ? panelSettingsData.source_hub
                      : 'WebSocket'
                  }
                  initialTabErrorMode={asErrorMode(panelSettingsData.proc_error_mode, 'RETRY')}
                  initialComponentCommand={
                    typeof effectiveData.proc_command === 'string' ? effectiveData.proc_command : ''
                  }
                  initialComponentErrorMode={asErrorMode(effectiveData.proc_error_mode, 'RETRY')}
                  effectivePreview={{
                    source_hub:
                      typeof effectiveData.source_hub === 'string' ? effectiveData.source_hub : '-',
                    proc_executor:
                      typeof effectiveData.proc_executor === 'string'
                        ? effectiveData.proc_executor
                        : 'UBLX_NATIVE_V1',
                    proc_error_mode:
                      typeof effectiveData.proc_error_mode === 'string'
                        ? effectiveData.proc_error_mode
                        : '-',
                  }}
                  isSavingTab={savePanelSettings.isPending}
                  isSavingComponent={saveInstanceConfig.isPending}
                  savedKey={savedKey}
                  onSaveTab={handleSaveTabSettings}
                  onSaveComponent={handleSaveComponent}
                />
              }
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </AppShell>
  );
}
