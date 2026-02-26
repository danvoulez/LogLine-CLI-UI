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
  useUpdateComponentFrontProps,
  useDaemonRuntimeStatus,
  useDaemonRunIntent,
  useDaemonStopIntent,
  useDaemonSelectProfile,
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
  initialComponentFrontProps,
  initialTabApiKey,
  initialTabLlmApiKey,
  initialTabWebhookUrl,
  initialTabWebsocketUrl,
  initialTabSseUrl,
  effectivePreview,
  isSavingTab,
  isSavingComponent,
  savedKey,
  onSaveTab,
  onSaveComponent,
  onSaveComponentFrontProps,
}: {
  panelName: string;
  selectedComponentId: string | null;
  hasSelectedComponent: boolean;
  initialTabSourceHub: string;
  initialTabErrorMode: ErrorMode;
  initialComponentCommand: string;
  initialComponentErrorMode: ErrorMode;
  initialComponentFrontProps: Record<string, unknown>;
  initialTabApiKey: string;
  initialTabLlmApiKey: string;
  initialTabWebhookUrl: string;
  initialTabWebsocketUrl: string;
  initialTabSseUrl: string;
  effectivePreview: {
    source_hub: string;
    proc_executor: string;
    proc_error_mode: string;
  };
  isSavingTab: boolean;
  isSavingComponent: boolean;
  savedKey: 'tab' | 'component' | null;
  onSaveTab: (draft: {
    source_hub: string;
    proc_error_mode: ErrorMode;
    api_key: string;
    llm_api_key: string;
    webhook_url: string;
    websocket_url: string;
    sse_url: string;
  }) => void;
  onSaveComponent: (draft: { proc_command: string; proc_error_mode: ErrorMode }) => void;
  onSaveComponentFrontProps: (nextFrontProps: Record<string, unknown>) => void;
}) {
  const [tabSourceHub, setTabSourceHub] = useState(initialTabSourceHub);
  const [tabErrorMode, setTabErrorMode] = useState<ErrorMode>(initialTabErrorMode);
  const [componentCommand, setComponentCommand] = useState(initialComponentCommand);
  const [componentErrorMode, setComponentErrorMode] = useState<ErrorMode>(initialComponentErrorMode);
  const [tabApiKey, setTabApiKey] = useState(initialTabApiKey);
  const [tabLlmApiKey, setTabLlmApiKey] = useState(initialTabLlmApiKey);
  const [tabWebhookUrl, setTabWebhookUrl] = useState(initialTabWebhookUrl);
  const [tabWebsocketUrl, setTabWebsocketUrl] = useState(initialTabWebsocketUrl);
  const [tabSseUrl, setTabSseUrl] = useState(initialTabSseUrl);
  const [intentType, setIntentType] = useState(initialComponentCommand || 'sync');
  const [intentPayload, setIntentPayload] = useState('{}');
  const [runIdToStop, setRunIdToStop] = useState('');
  const [profileId, setProfileId] = useState('local');
  const [runtimeFeedback, setRuntimeFeedback] = useState<string | null>(null);
  const [chatSessionId, setChatSessionId] = useState(
    typeof initialComponentFrontProps.chat_session_id === 'string' ? initialComponentFrontProps.chat_session_id : ''
  );
  const [chatAutoReply, setChatAutoReply] = useState(
    initialComponentFrontProps.chat_auto_reply === true || initialComponentFrontProps.chat_auto_reply === 'true'
  );
  const [chatAssistantPrefix, setChatAssistantPrefix] = useState(
    typeof initialComponentFrontProps.chat_assistant_prefix === 'string'
      ? initialComponentFrontProps.chat_assistant_prefix
      : 'Noted'
  );
  const [obsEventLimit, setObsEventLimit] = useState(
    typeof initialComponentFrontProps.observability_event_limit === 'number'
      ? String(initialComponentFrontProps.observability_event_limit)
      : '8'
  );
  const [obsKindContains, setObsKindContains] = useState(
    typeof initialComponentFrontProps.observability_kind_contains === 'string'
      ? initialComponentFrontProps.observability_kind_contains
      : ''
  );

  const daemonStatus = useDaemonRuntimeStatus();
  const runIntent = useDaemonRunIntent();
  const stopIntent = useDaemonStopIntent();
  const selectProfile = useDaemonSelectProfile();

  const handleRunIntent = () => {
    let payload: Record<string, string> = {};
    try {
      const parsed = JSON.parse(intentPayload) as Record<string, unknown>;
      payload = Object.fromEntries(
        Object.entries(parsed).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])
      );
    } catch {
      setRuntimeFeedback('Invalid payload JSON');
      return;
    }

    runIntent.mutate(
      { intent_type: intentType.trim(), payload },
      {
        onSuccess: (data) => {
          const runId = typeof data.run_id === 'string' ? data.run_id : '';
          if (runId) setRunIdToStop(runId);
          setRuntimeFeedback(runId ? `Intent started: ${runId}` : 'Intent started');
        },
        onError: (error) => setRuntimeFeedback(error.message),
      }
    );
  };

  const handleStopIntent = () => {
    if (!runIdToStop.trim()) {
      setRuntimeFeedback('Provide a run_id to stop');
      return;
    }
    stopIntent.mutate(
      { run_id: runIdToStop.trim() },
      {
        onSuccess: () => setRuntimeFeedback(`Stop sent: ${runIdToStop.trim()}`),
        onError: (error) => setRuntimeFeedback(error.message),
      }
    );
  };

  const handleSelectProfile = () => {
    if (!profileId.trim()) {
      setRuntimeFeedback('Provide a profile_id');
      return;
    }
    selectProfile.mutate(
      { profile_id: profileId.trim() },
      {
        onSuccess: () => setRuntimeFeedback(`Profile selected: ${profileId.trim()}`),
        onError: (error) => setRuntimeFeedback(error.message),
      }
    );
  };

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
          onClick={() =>
            onSaveTab({
              source_hub: tabSourceHub,
              proc_error_mode: tabErrorMode,
              api_key: tabApiKey,
              llm_api_key: tabLlmApiKey,
              webhook_url: tabWebhookUrl,
              websocket_url: tabWebsocketUrl,
              sse_url: tabSseUrl,
            })
          }
          variant="secondary"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[10px] text-white/45 mb-1 block">api_key</span>
            <input value={tabApiKey} onChange={(e) => setTabApiKey(e.target.value)} className="w-full bg-[#2a2a2a] border border-white/10 rounded px-2.5 py-2 text-xs" />
          </label>
          <label className="block">
            <span className="text-[10px] text-white/45 mb-1 block">llm_api_key</span>
            <input value={tabLlmApiKey} onChange={(e) => setTabLlmApiKey(e.target.value)} className="w-full bg-[#2a2a2a] border border-white/10 rounded px-2.5 py-2 text-xs" />
          </label>
          <label className="block">
            <span className="text-[10px] text-white/45 mb-1 block">webhook_url</span>
            <input value={tabWebhookUrl} onChange={(e) => setTabWebhookUrl(e.target.value)} className="w-full bg-[#2a2a2a] border border-white/10 rounded px-2.5 py-2 text-xs" />
          </label>
          <label className="block">
            <span className="text-[10px] text-white/45 mb-1 block">websocket_url</span>
            <input value={tabWebsocketUrl} onChange={(e) => setTabWebsocketUrl(e.target.value)} className="w-full bg-[#2a2a2a] border border-white/10 rounded px-2.5 py-2 text-xs" />
          </label>
          <label className="block md:col-span-2">
            <span className="text-[10px] text-white/45 mb-1 block">sse_url</span>
            <input value={tabSseUrl} onChange={(e) => setTabSseUrl(e.target.value)} className="w-full bg-[#2a2a2a] border border-white/10 rounded px-2.5 py-2 text-xs" />
          </label>
        </div>
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

      <section className="space-y-3 border border-white/10 bg-[#323232] rounded p-3">
        <div className="flex items-center justify-between">
          <h4 className="text-[10px] font-semibold tracking-wide text-white/70">Runtime Controls</h4>
          <span className="text-[8px] font-mono text-white/35">
            active_profile: {String(daemonStatus.data?.active_profile ?? '-')}
          </span>
        </div>

        <label className="block">
          <span className="text-[10px] text-white/45 mb-1 block">Intent Type</span>
          <input
            type="text"
            value={intentType}
            onChange={(e) => setIntentType(e.target.value)}
            className="w-full bg-[#2a2a2a] border border-white/10 rounded px-2.5 py-2 text-xs focus:outline-none focus:border-white/30"
          />
        </label>

        <label className="block">
          <span className="text-[10px] text-white/45 mb-1 block">Intent Payload (JSON)</span>
          <textarea
            value={intentPayload}
            onChange={(e) => setIntentPayload(e.target.value)}
            rows={4}
            className="w-full bg-[#2a2a2a] border border-white/10 rounded px-2.5 py-2 text-xs font-mono focus:outline-none focus:border-white/30"
          />
        </label>

        <QuickAction
          label={runIntent.isPending ? 'RUNNING...' : 'RUN INTENT'}
          onClick={handleRunIntent}
          variant="primary"
          disabled={runIntent.isPending}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[10px] text-white/45 mb-1 block">Stop Run ID</span>
            <input
              type="text"
              value={runIdToStop}
              onChange={(e) => setRunIdToStop(e.target.value)}
              className="w-full bg-[#2a2a2a] border border-white/10 rounded px-2.5 py-2 text-xs focus:outline-none focus:border-white/30"
            />
          </label>

          <label className="block">
            <span className="text-[10px] text-white/45 mb-1 block">Profile ID</span>
            <input
              type="text"
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              className="w-full bg-[#2a2a2a] border border-white/10 rounded px-2.5 py-2 text-xs focus:outline-none focus:border-white/30"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <QuickAction
            label={stopIntent.isPending ? 'STOPPING...' : 'STOP RUN'}
            onClick={handleStopIntent}
            variant="danger"
            disabled={stopIntent.isPending}
          />
          <QuickAction
            label={selectProfile.isPending ? 'SWITCHING...' : 'SELECT PROFILE'}
            onClick={handleSelectProfile}
            variant="secondary"
            disabled={selectProfile.isPending}
          />
        </div>

        <div className="text-[10px] border border-white/10 rounded p-2.5 bg-[#2a2a2a] space-y-1">
          <div className="text-white/55">Runtime Snapshot</div>
          <div className="text-white/35 font-mono">running_jobs: {String(daemonStatus.data?.running_jobs ?? '-')}</div>
          <div className="text-white/35 font-mono">queue_depth: {String(daemonStatus.data?.queue_depth ?? '-')}</div>
          {runtimeFeedback && <div className="text-blue-300 font-mono">{runtimeFeedback}</div>}
        </div>
      </section>

      {selectedComponentId === 'chat-ai' && (
        <section className="space-y-3 border border-white/10 bg-[#323232] rounded p-3">
          <h4 className="text-[10px] font-semibold tracking-wide text-white/70">Chat Cascade Overrides</h4>
          <label className="block">
            <span className="text-[10px] text-white/45 mb-1 block">chat_session_id</span>
            <input
              type="text"
              value={chatSessionId}
              onChange={(e) => setChatSessionId(e.target.value)}
              className="w-full bg-[#2a2a2a] border border-white/10 rounded px-2.5 py-2 text-xs"
            />
          </label>
          <label className="block">
            <span className="text-[10px] text-white/45 mb-1 block">chat_assistant_prefix</span>
            <input
              type="text"
              value={chatAssistantPrefix}
              onChange={(e) => setChatAssistantPrefix(e.target.value)}
              className="w-full bg-[#2a2a2a] border border-white/10 rounded px-2.5 py-2 text-xs"
            />
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={chatAutoReply}
              onChange={(e) => setChatAutoReply(e.target.checked)}
            />
            <span className="text-white/70">chat_auto_reply</span>
          </label>
          <QuickAction
            label="SAVE CHAT OVERRIDES"
            variant="secondary"
            onClick={() =>
              onSaveComponentFrontProps({
                ...initialComponentFrontProps,
                chat_session_id: chatSessionId,
                chat_auto_reply: chatAutoReply,
                chat_assistant_prefix: chatAssistantPrefix,
              })
            }
          />
        </section>
      )}

      {selectedComponentId === 'observability-hub' && (
        <section className="space-y-3 border border-white/10 bg-[#323232] rounded p-3">
          <h4 className="text-[10px] font-semibold tracking-wide text-white/70">Observability Cascade Overrides</h4>
          <label className="block">
            <span className="text-[10px] text-white/45 mb-1 block">observability_event_limit</span>
            <input
              type="number"
              min={1}
              max={30}
              value={obsEventLimit}
              onChange={(e) => setObsEventLimit(e.target.value)}
              className="w-full bg-[#2a2a2a] border border-white/10 rounded px-2.5 py-2 text-xs"
            />
          </label>
          <label className="block">
            <span className="text-[10px] text-white/45 mb-1 block">observability_kind_contains</span>
            <input
              type="text"
              value={obsKindContains}
              onChange={(e) => setObsKindContains(e.target.value)}
              className="w-full bg-[#2a2a2a] border border-white/10 rounded px-2.5 py-2 text-xs"
            />
          </label>
          <QuickAction
            label="SAVE OBSERVABILITY OVERRIDES"
            variant="secondary"
            onClick={() =>
              onSaveComponentFrontProps({
                ...initialComponentFrontProps,
                observability_event_limit: Math.max(1, Math.min(30, Number(obsEventLimit) || 8)),
                observability_kind_contains: obsKindContains,
              })
            }
          />
        </section>
      )}
    </div>
  );
}

export default function Page() {
  const { activePanelIndex, selectedInstanceByPanel, setSelectedInstance } = useUIStore();
  const { data: panels = [] } = usePanels();
  const savePanelSettings = useSavePanelSettings();
  const saveInstanceConfig = useSaveInstanceConfig();
  const updateComponentFrontProps = useUpdateComponentFrontProps();

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

  const handleSaveTabSettings = (draft: {
    source_hub: string;
    proc_error_mode: ErrorMode;
    api_key: string;
    llm_api_key: string;
    webhook_url: string;
    websocket_url: string;
    sse_url: string;
  }) => {
    if (!activePanel) return;
    savePanelSettings.mutate(
      {
        panelId: activePanel.panel_id,
        settings: {
          source_hub: draft.source_hub,
          proc_executor: 'UBLX_NATIVE_V1',
          proc_error_mode: draft.proc_error_mode,
          api_key: draft.api_key,
          llm_api_key: draft.llm_api_key,
          webhook_url: draft.webhook_url,
          websocket_url: draft.websocket_url,
          sse_url: draft.sse_url,
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

  const handleSaveComponentFrontProps = (nextFrontProps: Record<string, unknown>) => {
    if (!selectedInstance || !activePanel) return;
    updateComponentFrontProps.mutate({
      panelId: activePanel.panel_id,
      instanceId: selectedInstance.instance_id,
      front_props: nextFrontProps,
    });
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
                  initialComponentFrontProps={(selectedInstance?.front_props ?? {}) as Record<string, unknown>}
                  initialTabApiKey={typeof panelSettingsData.api_key === 'string' ? panelSettingsData.api_key : ''}
                  initialTabLlmApiKey={typeof panelSettingsData.llm_api_key === 'string' ? panelSettingsData.llm_api_key : ''}
                  initialTabWebhookUrl={typeof panelSettingsData.webhook_url === 'string' ? panelSettingsData.webhook_url : ''}
                  initialTabWebsocketUrl={typeof panelSettingsData.websocket_url === 'string' ? panelSettingsData.websocket_url : ''}
                  initialTabSseUrl={typeof panelSettingsData.sse_url === 'string' ? panelSettingsData.sse_url : ''}
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
                  onSaveComponentFrontProps={handleSaveComponentFrontProps}
                />
              }
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </AppShell>
  );
}
