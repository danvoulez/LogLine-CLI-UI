'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PanelComponentInstance } from '@/types/ublx';
import { useEffectiveConfig, useInstanceConfig, usePanelSettings, useSaveInstanceConfig, useSettings, useUpdateComponentFrontProps } from '@/lib/api/db-hooks';
import { Settings2, Repeat2 } from 'lucide-react';
import { useUIStore } from '@/stores/ui-store';
import { MOCK_COMPONENTS } from '@/mocks/ublx-mocks';
import { motion } from 'motion/react';
import { BlockPrimitive, LinePrimitive, TemplateHeader, TemplateIndicators, UnitPrimitive } from './TemplatePrimitives';
import { TemplateHealthState, TemplateInfoTone, TemplateSize, emitTemplateTelemetry, resolveTemplateContract, TEMPLATE_CONTRACT_VERSION } from '@/lib/config/component-template';

interface ComponentRendererProps {
  instance: PanelComponentInstance;
  panelId: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
}

function normalizeTagInput(value: string): string[] {
  const unique = new Set(
    value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
  );
  return Array.from(unique);
}

function csvFromTags(tags: string[]): string {
  return tags.join(', ');
}

function parseTagBindings(settings: Record<string, unknown>): string[] {
  const defaults = asRecord(settings.component_defaults);
  const baseTags = asRecord(defaults.tag_bindings);
  return Object.keys(baseTags);
}

function parseScopedAppTagBindings(settings: Record<string, unknown>, appScope: string): string[] {
  const defaults = asRecord(settings.component_defaults);
  const base = asRecord(defaults.tag_bindings);
  const scopes = asRecord(defaults.scopes);
  const apps = asRecord(defaults.apps);
  const scopedRaw = scopes[appScope] ?? apps[appScope];
  const scoped = asRecord(scopedRaw);
  const scopedTagBindings = asRecord(scoped.tag_bindings);
  return Object.keys({ ...base, ...scopedTagBindings });
}

function parseAppScopes(settings: Record<string, unknown>): string[] {
  const defaults = asRecord(settings.component_defaults);
  const scopes = Object.keys(asRecord(defaults.scopes));
  const apps = Object.keys(asRecord(defaults.apps));
  return Array.from(new Set([...scopes, ...apps])).filter((v) => v.trim().length > 0);
}

function parsePanelTagBindings(settings: Record<string, unknown>): string[] {
  const tagBindings = asRecord(settings.tag_bindings);
  return Object.keys(tagBindings);
}

function shortCopy(componentId: string): string {
  const map: Record<string, string> = {
    'chat-ai': 'chat replies',
    'observability-hub': 'event stream',
    'billing-daily': 'daily costs',
    'secret-field': 'secure token',
    'llm-status': 'provider status',
    'service-card': 'service state',
  };
  return map[componentId] ?? 'live signal';
}

export function ComponentRenderer({ instance, panelId }: ComponentRendererProps) {
  const effectiveConfig = useEffectiveConfig(instance.instance_id);
  const instanceConfig = useInstanceConfig(instance.instance_id);
  const panelSettings = usePanelSettings(panelId);
  const appSettings = useSettings();

  const updateFrontProps = useUpdateComponentFrontProps();
  const saveInstanceConfig = useSaveInstanceConfig();

  const selectedInstanceByPanel = useUIStore((state) => state.selectedInstanceByPanel);
  const setSelectedInstance = useUIStore((state) => state.setSelectedInstance);
  const flippedInstances = useUIStore((state) => state.flippedInstances);
  const toggleInstanceFlip = useUIStore((state) => state.toggleInstanceFlip);

  const frontProps = useMemo(
    () => (instance.front_props ?? {}) as Record<string, unknown>,
    [instance.front_props]
  );
  const templateContract = useMemo(
    () => resolveTemplateContract(instance.component_id, frontProps),
    [instance.component_id, frontProps]
  );

  const [templateSize, setTemplateSize] = useState<TemplateSize>(() => templateContract.template_size);
  const [health, setHealth] = useState<TemplateHealthState>(() => templateContract.health);
  const [infoTone, setInfoTone] = useState<TemplateInfoTone>(() => templateContract.info_tone);
  const [appImportTags, setAppImportTags] = useState<string>(() => csvFromTags(templateContract.import_app_tags));
  const [tabImportTags, setTabImportTags] = useState<string>(() => csvFromTags(templateContract.import_tab_tags));
  const [appScope, setAppScope] = useState<string>(templateContract.app_scope);
  const [connectionType, setConnectionType] = useState<string>(templateContract.connection_contract.type);
  const [connectionRef, setConnectionRef] = useState<string>(templateContract.connection_contract.ref);
  const [cliCommand, setCliCommand] = useState<string>(templateContract.cli_contract.command);
  const [overrideCascade, setOverrideCascade] = useState<boolean>(templateContract.override_cascade);

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const isSelected = selectedInstanceByPanel[panelId] === instance.instance_id;
  const isFlipped = flippedInstances[instance.instance_id] || false;

  const manifest = MOCK_COMPONENTS.find((m) => m.component_id === instance.component_id);
  const title = manifest?.name ?? instance.component_id;

  const missingRequiredTags = effectiveConfig.data?.missing_required_tags ?? [];
  const bindingSources = effectiveConfig.data?.binding_sources ?? {};

  const appTags = useMemo(() => {
    const settings = (appSettings.data ?? {}) as Record<string, unknown>;
    if (appScope.trim()) return parseScopedAppTagBindings(settings, appScope.trim());
    return parseTagBindings(settings);
  }, [appSettings.data, appScope]);
  const appScopes = useMemo(
    () => parseAppScopes((appSettings.data ?? {}) as Record<string, unknown>),
    [appSettings.data]
  );

  useEffect(() => {
    emitTemplateTelemetry('rendered', {
      component_id: instance.component_id,
      instance_id: instance.instance_id,
      panel_id: panelId,
      app_scope: appScope.trim(),
    });
  }, [instance.component_id, instance.instance_id, panelId, appScope]);

  const tabTags = useMemo(
    () => parsePanelTagBindings((panelSettings.data?.settings ?? {}) as Record<string, unknown>),
    [panelSettings.data?.settings]
  );

  const handleSave = () => {
    setSaveState('saving');

    const nextFrontProps: Record<string, unknown> = {
      ...frontProps,
      template_contract_version: TEMPLATE_CONTRACT_VERSION,
      template_size: templateSize,
      health,
      health_source: templateContract.health_source,
      info_tone: infoTone,
      display_density: templateContract.display_density,
      interaction_mode: templateContract.interaction_mode,
      refresh_policy: templateContract.refresh_policy,
      empty_state_label: templateContract.empty_state_label,
      error_state_mode: templateContract.error_state_mode,
      import_app_tags: normalizeTagInput(appImportTags),
      import_tab_tags: normalizeTagInput(tabImportTags),
      app_scope: appScope.trim(),
      connection_type: connectionType,
      connection_ref: connectionRef.trim(),
      cli_command: cliCommand.trim(),
      override_cascade: overrideCascade,
      required_bindings: templateContract.required_bindings,
      optional_bindings: templateContract.optional_bindings,
      connection_contract: {
        ...templateContract.connection_contract,
        type: connectionType,
        ref: connectionRef.trim(),
      },
      cli_contract: {
        ...templateContract.cli_contract,
        command: cliCommand.trim(),
      },
      permissions: templateContract.permissions,
      mobile_priority: templateContract.mobile_priority,
      telemetry_hooks: templateContract.telemetry_hooks,
    };

    updateFrontProps.mutate(
      {
        panelId,
        instanceId: instance.instance_id,
        front_props: nextFrontProps,
      },
      {
        onSuccess: () => {
          const base = (instanceConfig.data ?? {}) as Record<string, unknown>;
          saveInstanceConfig.mutate(
            {
              instanceId: instance.instance_id,
              config: {
                source_hub: typeof base.source_hub === 'string' ? base.source_hub : null,
                source_origin: connectionRef.trim() || (typeof base.source_origin === 'string' ? base.source_origin : null),
                source_auth_ref: typeof base.source_auth_ref === 'string' ? base.source_auth_ref : null,
                source_mode: typeof base.source_mode === 'string' ? base.source_mode : null,
                source_interval_ms: typeof base.source_interval_ms === 'number' ? base.source_interval_ms : null,
                proc_executor: typeof base.proc_executor === 'string' ? base.proc_executor : 'UBLX_NATIVE_V1',
                proc_command: cliCommand.trim() || (typeof base.proc_command === 'string' ? base.proc_command : null),
                proc_args: Array.isArray(base.proc_args) ? (base.proc_args as string[]) : [],
                proc_timeout_ms: typeof base.proc_timeout_ms === 'number' ? base.proc_timeout_ms : null,
                proc_retries: typeof base.proc_retries === 'number' ? base.proc_retries : null,
                proc_backoff: typeof base.proc_backoff === 'string' ? base.proc_backoff : null,
                proc_error_mode: typeof base.proc_error_mode === 'string' ? base.proc_error_mode : null,
              },
            },
            {
              onSettled: () => {
                emitTemplateTelemetry('settings_saved', {
                  component_id: instance.component_id,
                  instance_id: instance.instance_id,
                  panel_id: panelId,
                  app_scope: appScope.trim(),
                });
                setSaveState('saved');
                setTimeout(() => setSaveState('idle'), 1300);
              },
            }
          );
        },
        onError: () => setSaveState('idle'),
      }
    );
  };

  return (
    <div
      className={`w-full h-full relative rounded-xl ${
        isSelected ? 'ring-1 ring-white/30' : 'ring-1 ring-transparent'
      }`}
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
      <motion.div
        className="relative w-full h-full preserve-3d"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.28, ease: 'easeInOut' }}
      >
        <div className="absolute inset-0 backface-hidden rounded-xl border border-transparent bg-[var(--shell)] p-2 transition-all hover:border-white/10 hover:bg-white/[0.04] hover:scale-[1.01]">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleInstanceFlip(instance.instance_id);
              emitTemplateTelemetry('flip_opened', {
                component_id: instance.component_id,
                instance_id: instance.instance_id,
                panel_id: panelId,
              });
            }}
            className="absolute right-2 top-2 z-30 h-6 w-6 rounded border border-white/20 bg-white/[0.04] text-white/60 hover:bg-white/[0.1] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            title="Flip component settings"
            aria-label="Flip component settings"
          >
            <Settings2 size={10} className="mx-auto" />
          </button>

          <div className="h-full flex flex-col gap-2">
            <TemplateHeader title={title} subtitle={shortCopy(instance.component_id)} />

            <TemplateIndicators health={health} infoTone={infoTone} />

            <div className="mt-auto space-y-1.5">
              <LinePrimitive labelLeft={templateSize === 'unit' ? 'quick action' : 'status line'} labelRight={templateSize} />
              {templateSize === 'unit' && <UnitPrimitive label="tap" />}
              {templateSize === 'block' && <BlockPrimitive title="priority" body="graph/message zone" />}
            </div>
          </div>
        </div>

        <div className="absolute inset-0 backface-hidden rounded-xl border border-white/10 bg-[var(--shell)] p-2 overflow-auto custom-scrollbar" style={{ transform: 'rotateY(180deg)' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleInstanceFlip(instance.instance_id);
            }}
            className="absolute right-2 top-2 z-30 h-6 w-6 rounded border border-white/20 bg-white/[0.04] text-white/60 hover:bg-white/[0.1] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            title="Flip back"
            aria-label="Flip component back"
          >
            <Repeat2 size={10} className="mx-auto" />
          </button>

          <div className="space-y-2 pr-6 text-[10px] text-white/70">
            <p className="text-white/80">Template Settings</p>

            <div className="grid grid-cols-2 gap-1.5">
              <label className="space-y-1">
                <span className="text-white/45">Size</span>
                <select
                  value={templateSize}
                  onChange={(e) => setTemplateSize(e.target.value as TemplateSize)}
                  className="w-full rounded border border-white/15 bg-white/[0.03] px-2 py-1"
                >
                  <option value="unit">1x1 unit</option>
                  <option value="line">2x1 line</option>
                  <option value="block">2x2 block</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-white/45">Health</span>
                <select
                  value={health}
                  onChange={(e) => setHealth(e.target.value as TemplateHealthState)}
                  className="w-full rounded border border-white/15 bg-white/[0.03] px-2 py-1"
                >
                  <option value="ok">OK (green)</option>
                  <option value="not_ok">Not OK (red)</option>
                </select>
              </label>
            </div>

            <label className="space-y-1 block">
              <span className="text-white/45">Info Color</span>
              <select
                value={infoTone}
                onChange={(e) => setInfoTone(e.target.value as TemplateInfoTone)}
                className="w-full rounded border border-white/15 bg-white/[0.03] px-2 py-1"
              >
                <option value="blue">Blue</option>
                <option value="purple">Purple</option>
                <option value="orange">Orange</option>
              </select>
            </label>

            <div className="space-y-1.5 border border-white/10 rounded p-2 bg-white/[0.02]">
              <p className="text-white/55">Import Tags</p>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  value={appScope}
                  onChange={(e) => setAppScope(e.target.value)}
                  placeholder="app scope (e.g. app-x)"
                  className="w-full rounded border border-white/15 bg-white/[0.03] px-2 py-1"
                />
                <select
                  value={appScope}
                  onChange={(e) => setAppScope(e.target.value)}
                  className="w-full rounded border border-white/15 bg-white/[0.03] px-2 py-1"
                >
                  <option value="">no scoped app</option>
                  {appScopes.map((scopeKey) => (
                    <option key={scopeKey} value={scopeKey}>
                      {scopeKey}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setAppImportTags(csvFromTags(appTags))}
                  className="rounded border border-blue-400/30 px-2 py-1 text-blue-300"
                >
                  import app tags
                </button>
                <button
                  type="button"
                  onClick={() => setTabImportTags(csvFromTags(tabTags))}
                  className="rounded border border-violet-400/30 px-2 py-1 text-violet-300"
                >
                  import tab tags
                </button>
              </div>
              <input
                value={appImportTags}
                onChange={(e) => setAppImportTags(e.target.value)}
                placeholder="app tags (comma separated)"
                className="w-full rounded border border-white/15 bg-white/[0.03] px-2 py-1"
              />
              <input
                value={tabImportTags}
                onChange={(e) => setTabImportTags(e.target.value)}
                placeholder="tab tags (comma separated)"
                className="w-full rounded border border-white/15 bg-white/[0.03] px-2 py-1"
              />
            </div>

            <div className="space-y-1.5 border border-white/10 rounded p-2 bg-white/[0.02]">
              <p className="text-white/55">Connections + CLI Override</p>
              <select
                value={connectionType}
                onChange={(e) => setConnectionType(e.target.value)}
                className="w-full rounded border border-white/15 bg-white/[0.03] px-2 py-1"
              >
                <option value="websocket">websocket</option>
                <option value="sse">sse</option>
                <option value="webhook">webhook</option>
                <option value="http">http</option>
                <option value="internal">internal</option>
              </select>
              <input
                value={connectionRef}
                onChange={(e) => setConnectionRef(e.target.value)}
                placeholder="connection URL or endpoint"
                className="w-full rounded border border-white/15 bg-white/[0.03] px-2 py-1"
              />
              <input
                value={cliCommand}
                onChange={(e) => setCliCommand(e.target.value)}
                placeholder="cli command to override"
                className="w-full rounded border border-white/15 bg-white/[0.03] px-2 py-1"
              />
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={overrideCascade}
                  onChange={(e) => setOverrideCascade(e.target.checked)}
                />
                <span>override tab/app cascade</span>
              </label>
            </div>

            {missingRequiredTags.length > 0 && (
              <div className="rounded border border-amber-400/25 bg-amber-500/10 px-2 py-1 text-amber-200">
                Missing tags: {missingRequiredTags.join(', ')}
              </div>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={saveState === 'saving' || updateFrontProps.isPending || saveInstanceConfig.isPending}
              className="w-full rounded border border-white/20 bg-white/[0.06] px-2 py-1.5 text-white/85 hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-50"
            >
              {saveState === 'saved' ? 'saved' : saveState === 'saving' ? 'saving...' : 'save component settings'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
