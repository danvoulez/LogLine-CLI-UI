'use client';

import React, { useEffect, useState } from 'react';
import { useUIStore } from '@/stores/ui-store';
import { usePanels, useCreatePanel, useSettings, useUpdateSetting } from '@/lib/api/db-hooks';
import { AppShell } from '@/components/shell/AppShell';
import { PanelRenderer } from '@/components/panel/PanelRenderer';
import { motion, AnimatePresence } from 'motion/react';
import { QuickAction } from '@/components/component-catalog/QuickAction';

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

function AppSettingsModal({
  initial,
  isSaving,
  savedKey,
  onClose,
  onSave,
}: {
  initial: MainSettingsDraft;
  isSaving: boolean;
  savedKey: 'main' | null;
  onClose: () => void;
  onSave: (draft: MainSettingsDraft) => void;
}) {
  const [draft, setDraft] = useState<MainSettingsDraft>(initial);

  useEffect(() => {
    setDraft(initial);
  }, [initial]);

  return (
    <div className="absolute inset-0 z-[120] bg-black/40 flex items-center justify-center p-3" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-lg border border-white/15 bg-[#2b2b2b] p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-white/80 tracking-wide">App Settings</h3>
          <button onClick={onClose} className="text-[11px] text-white/55 hover:text-white/80">Close</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[10px] text-white/45 mb-1 block">api_key</span>
            <input value={draft.api_key} onChange={(e) => setDraft((p) => ({ ...p, api_key: e.target.value }))} className="w-full bg-[#252525] border border-white/10 rounded px-2.5 py-2 text-xs" />
          </label>
          <label className="block">
            <span className="text-[10px] text-white/45 mb-1 block">llm_api_key</span>
            <input value={draft.llm_api_key} onChange={(e) => setDraft((p) => ({ ...p, llm_api_key: e.target.value }))} className="w-full bg-[#252525] border border-white/10 rounded px-2.5 py-2 text-xs" />
          </label>
          <label className="block">
            <span className="text-[10px] text-white/45 mb-1 block">llm_gateway_base_url</span>
            <input value={draft.llm_gateway_base_url} onChange={(e) => setDraft((p) => ({ ...p, llm_gateway_base_url: e.target.value }))} className="w-full bg-[#252525] border border-white/10 rounded px-2.5 py-2 text-xs" />
          </label>
          <label className="block">
            <span className="text-[10px] text-white/45 mb-1 block">llm_gateway_api_key</span>
            <input value={draft.llm_gateway_api_key} onChange={(e) => setDraft((p) => ({ ...p, llm_gateway_api_key: e.target.value }))} className="w-full bg-[#252525] border border-white/10 rounded px-2.5 py-2 text-xs" />
          </label>
          <label className="block md:col-span-2">
            <span className="text-[10px] text-white/45 mb-1 block">llm_gateway_admin_key</span>
            <input value={draft.llm_gateway_admin_key} onChange={(e) => setDraft((p) => ({ ...p, llm_gateway_admin_key: e.target.value }))} className="w-full bg-[#252525] border border-white/10 rounded px-2.5 py-2 text-xs" />
          </label>
          <label className="block">
            <span className="text-[10px] text-white/45 mb-1 block">webhook_url</span>
            <input value={draft.webhook_url} onChange={(e) => setDraft((p) => ({ ...p, webhook_url: e.target.value }))} className="w-full bg-[#252525] border border-white/10 rounded px-2.5 py-2 text-xs" />
          </label>
          <label className="block">
            <span className="text-[10px] text-white/45 mb-1 block">websocket_url</span>
            <input value={draft.websocket_url} onChange={(e) => setDraft((p) => ({ ...p, websocket_url: e.target.value }))} className="w-full bg-[#252525] border border-white/10 rounded px-2.5 py-2 text-xs" />
          </label>
          <label className="block md:col-span-2">
            <span className="text-[10px] text-white/45 mb-1 block">sse_url</span>
            <input value={draft.sse_url} onChange={(e) => setDraft((p) => ({ ...p, sse_url: e.target.value }))} className="w-full bg-[#252525] border border-white/10 rounded px-2.5 py-2 text-xs" />
          </label>
        </div>
        <QuickAction
          label={savedKey === 'main' ? 'APP SAVED' : isSaving ? 'SAVING...' : 'SAVE APP SETTINGS'}
          onClick={() => onSave(draft)}
          variant="secondary"
          disabled={isSaving}
        />
      </div>
    </div>
  );
}

export default function Page() {
  const {
    activePanelIndex,
    setActivePanelIndex,
    isAppSettingsOpen,
    closeAppSettings,
  } = useUIStore();

  const panelsQuery = usePanels();
  const { data: panels = [] } = panelsQuery;
  const createPanel = useCreatePanel();
  const settings = useSettings();
  const updateSetting = useUpdateSetting();

  const [savedKey, setSavedKey] = useState<'main' | null>(null);

  const activePanel = panels[activePanelIndex];

  const showSaved = () => {
    setSavedKey('main');
    setTimeout(() => setSavedKey(null), 1800);
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
      { onSuccess: () => showSaved() }
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
            <PanelRenderer manifest={activePanel} />

            {isAppSettingsOpen && (
              <AppSettingsModal
                initial={{
                  api_key: typeof appComponentDefaults.api_key === 'string' ? appComponentDefaults.api_key : '',
                  llm_api_key: typeof appComponentDefaults.llm_api_key === 'string' ? appComponentDefaults.llm_api_key : '',
                  llm_gateway_base_url:
                    typeof appComponentDefaults.llm_gateway_base_url === 'string'
                      ? appComponentDefaults.llm_gateway_base_url
                      : '',
                  llm_gateway_api_key:
                    typeof appComponentDefaults.llm_gateway_api_key === 'string'
                      ? appComponentDefaults.llm_gateway_api_key
                      : '',
                  llm_gateway_admin_key:
                    typeof appComponentDefaults.llm_gateway_admin_key === 'string'
                      ? appComponentDefaults.llm_gateway_admin_key
                      : '',
                  webhook_url: typeof appComponentDefaults.webhook_url === 'string' ? appComponentDefaults.webhook_url : '',
                  websocket_url:
                    typeof appComponentDefaults.websocket_url === 'string'
                      ? appComponentDefaults.websocket_url
                      : '',
                  sse_url: typeof appComponentDefaults.sse_url === 'string' ? appComponentDefaults.sse_url : '',
                }}
                isSaving={updateSetting.isPending}
                savedKey={savedKey}
                onSave={handleSaveMainSettings}
                onClose={closeAppSettings}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </AppShell>
  );
}
