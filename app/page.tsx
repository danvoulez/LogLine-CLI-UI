'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useUIStore } from '@/stores/ui-store';
import {
  usePanels,
  useCreatePanel,
  usePanelSettings,
  useSavePanelSettings,
  useInstanceConfig,
  useEffectiveConfig,
  useSaveInstanceConfig,
  useUpdateComponentFrontProps,
  useSettings,
  useUpdateSetting,
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
type MainSettingsDraft = {
  api_key: string;
  llm_api_key: string;
  llm_gateway_base_url: string;
  llm_gateway_api_key: string;
  llm_gateway_admin_key: string;
  webhook_url: string;
  websocket_url: string;
  sse_url: string;
};

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
  initialTabLlmGatewayBaseUrl,
  initialTabLlmGatewayApiKey,
  initialTabLlmGatewayAdminKey,
  initialTabWebhookUrl,
  initialTabWebsocketUrl,
  initialTabSseUrl,
  initialMainApiKey,
  initialMainLlmApiKey,
  initialMainLlmGatewayBaseUrl,
  initialMainLlmGatewayApiKey,
  initialMainLlmGatewayAdminKey,
  initialMainWebhookUrl,
  initialMainWebsocketUrl,
  initialMainSseUrl,
  effectivePreview,
  bindings,
  bindingSources,
  missingRequiredTags,
  isSavingMain,
  isSavingTab,
  isSavingComponent,
  savedKey,
  onSaveMain,
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
  initialTabLlmGatewayBaseUrl: string;
  initialTabLlmGatewayApiKey: string;
  initialTabLlmGatewayAdminKey: string;
  initialTabWebhookUrl: string;
  initialTabWebsocketUrl: string;
  initialTabSseUrl: string;
  initialMainApiKey: string;
  initialMainLlmApiKey: string;
  initialMainLlmGatewayBaseUrl: string;
  initialMainLlmGatewayApiKey: string;
  initialMainLlmGatewayAdminKey: string;
  initialMainWebhookUrl: string;
  initialMainWebsocketUrl: string;
  initialMainSseUrl: string;
  effectivePreview: {
    source_hub: string;
    proc_executor: string;
    proc_error_mode: string;
  };
  bindings: Record<string, unknown>;
  bindingSources: Record<string, { source: 'instance' | 'panel' | 'app'; matched_tag: string }>;
  missingRequiredTags: string[];
  isSavingMain: boolean;
  isSavingTab: boolean;
  isSavingComponent: boolean;
  savedKey: 'main' | 'tab' | 'component' | null;
  onSaveMain: (draft: MainSettingsDraft) => void;
  onSaveTab: (draft: {
    source_hub: string;
    proc_error_mode: ErrorMode;
    api_key: string;
    llm_api_key: string;
    llm_gateway_base_url: string;
    llm_gateway_api_key: string;
    llm_gateway_admin_key: string;
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
  const [tabLlmGatewayBaseUrl, setTabLlmGatewayBaseUrl] = useState(initialTabLlmGatewayBaseUrl);
  const [tabLlmGatewayApiKey, setTabLlmGatewayApiKey] = useState(initialTabLlmGatewayApiKey);
  const [tabLlmGatewayAdminKey, setTabLlmGatewayAdminKey] = useState(initialTabLlmGatewayAdminKey);
  const [tabWebhookUrl, setTabWebhookUrl] = useState(initialTabWebhookUrl);
  const [tabWebsocketUrl, setTabWebsocketUrl] = useState(initialTabWebsocketUrl);
  const [tabSseUrl, setTabSseUrl] = useState(initialTabSseUrl);
  const [mainApiKey, setMainApiKey] = useState(initialMainApiKey);
  const [mainLlmApiKey, setMainLlmApiKey] = useState(initialMainLlmApiKey);
  const [mainLlmGatewayBaseUrl, setMainLlmGatewayBaseUrl] = useState(initialMainLlmGatewayBaseUrl);
  const [mainLlmGatewayApiKey, setMainLlmGatewayApiKey] = useState(initialMainLlmGatewayApiKey);
  const [mainLlmGatewayAdminKey, setMainLlmGatewayAdminKey] = useState(initialMainLlmGatewayAdminKey);
  const [mainWebhookUrl, setMainWebhookUrl] = useState(initialMainWebhookUrl);
  const [mainWebsocketUrl, setMainWebsocketUrl] = useState(initialMainWebsocketUrl);
  const [mainSseUrl, setMainSseUrl] = useState(initialMainSseUrl);
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
          <h4 className="text-[10px] font-semibold tracking-wide text-white/70">Main Defaults (Global)</h4>
          <span className="text-[8px] font-mono text-white/35">All Tabs</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[10px] text-white/45 mb-1 block">api_key</span>
            <input value={mainApiKey} onChange={(e) => setMainApiKey(e.target.value)} className="w-full bg-[#2a2a2a] border border-white/10 rounded px-2.5 py-2 text-xs" />
          </label>
          <label className="block">
            <span className="text-[10px] text-white/45 mb-1 block">llm_api_key</span>
            <input value={mainLlmApiKey} onChange={(e) => setMainLlmApiKey(e.target.value)} className="w-full bg-[#2a2a2a] border border-white/10 rounded px-2.5 py-2 text-xs" />
          </label>
          <label className="block">
            <span className="text-[10px] text-white/45 mb-1 block">llm_gateway_base_url</span>
            <input value={mainLlmGatewayBaseUrl} onChange={(e) => setMainLlmGatewayBaseUrl(e.target.value)} className="w-full bg-[#2a2a2a] border border-white/10 rounded px-2.5 py-2 text-xs" />
          </label>
          <label className="block">
            <span className="text-[10px] text-white/45 mb-1 block">llm_gateway_api_key</span>
            <input value={mainLlmGatewayApiKey} onChange={(e) => setMainLlmGatewayApiKey(e.target.value)} className="w-full bg-[#2a2a2a] border border-white/10 rounded px-2.5 py-2 text-xs" />
          </label>
          <label className="block md:col-span-2">
            <span className="text-[10px] text-white/45 mb-1 block">llm_gateway_admin_key</span>
            <input value={mainLlmGatewayAdminKey} onChange={(e) => setMainLlmGatewayAdminKey(e.target.value)} className="w-full bg-[#2a2a2a] border border-white/10 rounded px-2.5 py-2 text-xs" />
          </label>
          <label className="block">
            <span className="text-[10px] text-white/45 mb-1 block">webhook_url</span>
            <input value={mainWebhookUrl} onChange={(e) => setMainWebhookUrl(e.target.value)} className="w-full bg-[#2a2a2a] border border-white/10 rounded px-2.5 py-2 text-xs" />
          </label>
          <label className="block">
            <span className="text-[10px] text-white/45 mb-1 block">websocket_url</span>
            <input value={mainWebsocketUrl} onChange={(e) => setMainWebsocketUrl(e.target.value)} className="w-full bg-[#2a2a2a] border border-white/10 rounded px-2.5 py-2 text-xs" />
          </label>
          <label className="block md:col-span-2">
            <span className="text-[10px] text-white/45 mb-1 block">sse_url</span>
            <input value={mainSseUrl} onChange={(e) => setMainSseUrl(e.target.value)} className="w-full bg-[#2a2a2a] border border-white/10 rounded px-2.5 py-2 text-xs" />
          </label>
        </div>
        <QuickAction
          label={savedKey === 'main' ? 'MAIN SAVED' : isSavingMain ? 'SAVING...' : 'SAVE MAIN DEFAULTS'}
          onClick={() =>
            onSaveMain({
              api_key: mainApiKey,
              llm_api_key: mainLlmApiKey,
              llm_gateway_base_url: mainLlmGatewayBaseUrl,
              llm_gateway_api_key: mainLlmGatewayApiKey,
              llm_gateway_admin_key: mainLlmGatewayAdminKey,
              webhook_url: mainWebhookUrl,
              websocket_url: mainWebsocketUrl,
              sse_url: mainSseUrl,
            })
          }
          variant="secondary"
          disabled={isSavingMain}
        />
      </section>

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
              llm_gateway_base_url: tabLlmGatewayBaseUrl,
              llm_gateway_api_key: tabLlmGatewayApiKey,
              llm_gateway_admin_key: tabLlmGatewayAdminKey,
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
            <span className="text-[10px] text-white/45 mb-1 block">llm_gateway_base_url</span>
            <input value={tabLlmGatewayBaseUrl} onChange={(e) => setTabLlmGatewayBaseUrl(e.target.value)} className="w-full bg-[#2a2a2a] border border-white/10 rounded px-2.5 py-2 text-xs" />
          </label>
          <label className="block">
            <span className="text-[10px] text-white/45 mb-1 block">llm_gateway_api_key</span>
            <input value={tabLlmGatewayApiKey} onChange={(e) => setTabLlmGatewayApiKey(e.target.value)} className="w-full bg-[#2a2a2a] border border-white/10 rounded px-2.5 py-2 text-xs" />
          </label>
          <label className="block md:col-span-2">
            <span className="text-[10px] text-white/45 mb-1 block">llm_gateway_admin_key</span>
            <input value={tabLlmGatewayAdminKey} onChange={(e) => setTabLlmGatewayAdminKey(e.target.value)} className="w-full bg-[#2a2a2a] border border-white/10 rounded px-2.5 py-2 text-xs" />
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

            <div className="text-[10px] border border-white/10 rounded p-2.5 bg-[#2a2a2a] space-y-2">
              <div className="text-white/55">Binding Inspector</div>
              {Object.keys(bindingSources).length === 0 ? (
                <div className="text-white/35">No bindings resolved for this component.</div>
              ) : (
                <div className="space-y-1">
                  {Object.entries(bindingSources).map(([requestedTag, meta]) => (
                    <div key={requestedTag} className="grid grid-cols-[1.5fr_1fr_1fr] gap-2 items-start">
                      <div className="text-white/70 font-mono truncate">{requestedTag}</div>
                      <div className="text-white/45">{meta.source}</div>
                      <div className="text-white/35 font-mono truncate">{String(bindings[requestedTag] ?? '-')}</div>
                    </div>
                  ))}
                </div>
              )}
              {missingRequiredTags.length > 0 && (
                <div className="text-amber-200 border border-amber-400/20 bg-amber-400/10 rounded p-1.5">
                  Missing required tags: {missingRequiredTags.join(', ')}
                </div>
              )}
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
  const { activePanelIndex, selectedInstanceByPanel, setSelectedInstance, setActivePanelIndex } = useUIStore();
  const panelsQuery = usePanels();
  const { data: panels = [] } = panelsQuery;
  const createPanel = useCreatePanel();
  const savePanelSettings = useSavePanelSettings();
  const saveInstanceConfig = useSaveInstanceConfig();
  const updateComponentFrontProps = useUpdateComponentFrontProps();
  const settings = useSettings();
  const updateSetting = useUpdateSetting();

  const [savedKey, setSavedKey] = useState<'main' | 'tab' | 'component' | null>(null);

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

  const showSaved = (key: 'main' | 'tab' | 'component') => {
    setSavedKey(key);
    setTimeout(() => setSavedKey(null), 1800);
  };

  const handleSaveTabSettings = (draft: {
    source_hub: string;
    proc_error_mode: ErrorMode;
    api_key: string;
    llm_api_key: string;
    llm_gateway_base_url: string;
    llm_gateway_api_key: string;
    llm_gateway_admin_key: string;
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
          llm_gateway_base_url: draft.llm_gateway_base_url,
          llm_gateway_api_key: draft.llm_gateway_api_key,
          llm_gateway_admin_key: draft.llm_gateway_admin_key,
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

  const appComponentDefaults = (() => {
    const source = settings.data as Record<string, unknown> | undefined;
    const defaults = source?.component_defaults;
    return defaults && typeof defaults === 'object' && !Array.isArray(defaults)
      ? (defaults as Record<string, unknown>)
      : {};
  })();

  const handleSaveMainSettings = (draft: MainSettingsDraft) => {
    const previousTagBindings =
      appComponentDefaults.tag_bindings &&
      typeof appComponentDefaults.tag_bindings === 'object' &&
      !Array.isArray(appComponentDefaults.tag_bindings)
        ? (appComponentDefaults.tag_bindings as Record<string, unknown>)
        : {};

    const nextDefaults = {
      ...appComponentDefaults,
      api_key: draft.api_key,
      llm_api_key: draft.llm_api_key,
      llm_gateway_base_url: draft.llm_gateway_base_url,
      llm_gateway_api_key: draft.llm_gateway_api_key,
      llm_gateway_admin_key: draft.llm_gateway_admin_key,
      webhook_url: draft.webhook_url,
      websocket_url: draft.websocket_url,
      sse_url: draft.sse_url,
      tag_bindings: {
        ...previousTagBindings,
        'secret:api': draft.api_key,
        'secret:llm': draft.llm_api_key,
        'llm:api_key': draft.llm_api_key,
        'backend:llm_gateway:url': draft.llm_gateway_base_url,
        'secret:llm_gateway:key': draft.llm_gateway_api_key,
        'secret:llm_gateway:admin': draft.llm_gateway_admin_key,
        'transport:webhook': draft.webhook_url,
        'transport:websocket': draft.websocket_url,
        'transport:sse': draft.sse_url,
      },
    };

    updateSetting.mutate(
      { key: 'component_defaults', value: nextDefaults },
      { onSuccess: () => showSaved('main') }
    );
  };

  if (!activePanel) {
    return (
      <AppShell>
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-full max-w-md rounded-lg border border-white/10 bg-[#2a2a2a] p-5 text-white/80">
            <div className="text-sm font-semibold text-white/85">No tabs yet</div>
            <div className="mt-1 text-xs text-white/55">
              {panelsQuery.isError
                ? `Could not load panels (${panelsQuery.error instanceof Error ? panelsQuery.error.message : 'unknown error'}).`
                : 'Create your first tab to start composing components.'}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  createPanel.mutate(
                    { name: 'New Tab' },
                    {
                      onSuccess: () => {
                        setActivePanelIndex(0);
                      },
                    }
                  );
                }}
                disabled={createPanel.isPending}
                className="rounded border border-white/20 bg-[#343434] px-3 py-1.5 text-[11px] font-semibold text-white/85 hover:bg-[#3a3a3a] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createPanel.isPending ? 'Creating...' : 'Create first tab'}
              </button>
              {panelsQuery.isError && (
                <button
                  type="button"
                  onClick={() => panelsQuery.refetch()}
                  className="rounded border border-white/15 bg-[#2d2d2d] px-3 py-1.5 text-[11px] text-white/70 hover:bg-[#333]"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

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
                  initialTabLlmGatewayBaseUrl={typeof panelSettingsData.llm_gateway_base_url === 'string' ? panelSettingsData.llm_gateway_base_url : ''}
                  initialTabLlmGatewayApiKey={typeof panelSettingsData.llm_gateway_api_key === 'string' ? panelSettingsData.llm_gateway_api_key : ''}
                  initialTabLlmGatewayAdminKey={typeof panelSettingsData.llm_gateway_admin_key === 'string' ? panelSettingsData.llm_gateway_admin_key : ''}
                  initialTabWebhookUrl={typeof panelSettingsData.webhook_url === 'string' ? panelSettingsData.webhook_url : ''}
                  initialTabWebsocketUrl={typeof panelSettingsData.websocket_url === 'string' ? panelSettingsData.websocket_url : ''}
                  initialTabSseUrl={typeof panelSettingsData.sse_url === 'string' ? panelSettingsData.sse_url : ''}
                  initialMainApiKey={typeof appComponentDefaults.api_key === 'string' ? appComponentDefaults.api_key : ''}
                  initialMainLlmApiKey={typeof appComponentDefaults.llm_api_key === 'string' ? appComponentDefaults.llm_api_key : ''}
                  initialMainLlmGatewayBaseUrl={typeof appComponentDefaults.llm_gateway_base_url === 'string' ? appComponentDefaults.llm_gateway_base_url : ''}
                  initialMainLlmGatewayApiKey={typeof appComponentDefaults.llm_gateway_api_key === 'string' ? appComponentDefaults.llm_gateway_api_key : ''}
                  initialMainLlmGatewayAdminKey={typeof appComponentDefaults.llm_gateway_admin_key === 'string' ? appComponentDefaults.llm_gateway_admin_key : ''}
                  initialMainWebhookUrl={typeof appComponentDefaults.webhook_url === 'string' ? appComponentDefaults.webhook_url : ''}
                  initialMainWebsocketUrl={typeof appComponentDefaults.websocket_url === 'string' ? appComponentDefaults.websocket_url : ''}
                  initialMainSseUrl={typeof appComponentDefaults.sse_url === 'string' ? appComponentDefaults.sse_url : ''}
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
                  bindings={effectiveConfig.data?.bindings ?? {}}
                  bindingSources={effectiveConfig.data?.binding_sources ?? {}}
                  missingRequiredTags={effectiveConfig.data?.missing_required_tags ?? []}
                  isSavingMain={updateSetting.isPending}
                  isSavingTab={savePanelSettings.isPending}
                  isSavingComponent={saveInstanceConfig.isPending}
                  savedKey={savedKey}
                  onSaveMain={handleSaveMainSettings}
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
