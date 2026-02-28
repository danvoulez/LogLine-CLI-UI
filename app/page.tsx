'use client';

import React, { useEffect, useState } from 'react';
import { useUIStore } from '@/stores/ui-store';
import { usePanels, useCreatePanel, useSettings, useUpdateSetting } from '@/lib/api/db-hooks';
import { AppShell } from '@/components/shell/AppShell';
import { PanelRenderer } from '@/components/panel/PanelRenderer';
import { motion, AnimatePresence } from 'motion/react';
import { QuickAction } from '@/components/component-catalog/QuickAction';
import { useAuth } from './providers';
import { getSupabaseBrowserClient } from '@/lib/auth/supabase-browser';

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

function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setError(null);
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setDone(true);
    setTimeout(() => window.location.reload(), 1500);
  };

  return (
    <div className="safe-app-frame flex flex-col items-center justify-center bg-[var(--shell)] px-4">
      <div className="w-full max-w-xs space-y-6">
        <div className="text-center">
          <h1 className="text-lg font-black tracking-tight text-white/90">UBLX</h1>
          <p className="mt-1 text-[11px] text-white/40">Set your new password</p>
        </div>
        {done ? (
          <p className="text-center text-xs text-emerald-400">Password updated. Redirecting...</p>
        ) : (
          <form onSubmit={handleUpdate} className="space-y-3">
            <input type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="w-full bg-[#252525] border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-white/25" />
            <input type="password" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} className="w-full bg-[#252525] border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-white/25" />
            {error && <p className="text-[10px] text-red-400/80">{error}</p>}
            <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors disabled:opacity-50">
              {loading ? 'Updating...' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function LoginGate() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    const supabase = getSupabaseBrowserClient();

    if (mode === 'forgot') {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}`,
      });
      setLoading(false);
      if (resetErr) { setError(resetErr.message); return; }
      setInfo('Check your email for a password reset link.');
      return;
    }

    const { error: authError } =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setLoading(false);
    if (authError) {
      setError(authError.message);
    }
  };

  const inputClass = "w-full bg-[#252525] border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-white/25";

  return (
    <div className="safe-app-frame flex flex-col items-center justify-center bg-[var(--shell)] px-4">
      <div className="w-full max-w-xs space-y-6">
        <div className="text-center">
          <h1 className="text-lg font-black tracking-tight text-white/90">UBLX</h1>
          <p className="mt-1 text-[11px] text-white/40">LogLine Ops</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} />

          {mode !== 'forgot' && (
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className={inputClass} />
          )}

          {error && <p className="text-[10px] text-red-400/80">{error}</p>}
          {info && <p className="text-[10px] text-emerald-400/80">{info}</p>}

          <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors disabled:opacity-50">
            {loading
              ? 'Please wait...'
              : mode === 'login'
                ? 'Sign in'
                : mode === 'signup'
                  ? 'Create account'
                  : 'Send reset link'}
          </button>
        </form>

        <div className="text-center space-y-1.5">
          {mode === 'login' && (
            <>
              <p className="text-[10px] text-white/30">
                <button onClick={() => { setMode('forgot'); setError(null); setInfo(null); }} className="text-white/50 hover:text-white/70 underline">
                  Forgot password?
                </button>
              </p>
              <p className="text-[10px] text-white/30">
                No account?{' '}
                <button onClick={() => { setMode('signup'); setError(null); setInfo(null); }} className="text-white/50 hover:text-white/70 underline">
                  Sign up
                </button>
              </p>
            </>
          )}
          {mode === 'signup' && (
            <p className="text-[10px] text-white/30">
              Already have an account?{' '}
              <button onClick={() => { setMode('login'); setError(null); setInfo(null); }} className="text-white/50 hover:text-white/70 underline">
                Sign in
              </button>
            </p>
          )}
          {mode === 'forgot' && (
            <p className="text-[10px] text-white/30">
              <button onClick={() => { setMode('login'); setError(null); setInfo(null); }} className="text-white/50 hover:text-white/70 underline">
                Back to sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const { session, loading: authLoading, isRecovery } = useAuth();

  if (authLoading) {
    return (
      <div className="safe-app-frame flex w-full items-center justify-center bg-[var(--shell)]">
        <span className="text-white/20 text-xs font-mono animate-pulse tracking-widest uppercase">Initializing...</span>
      </div>
    );
  }

  if (isRecovery && session) {
    return <ResetPasswordForm />;
  }

  if (!session) {
    return <LoginGate />;
  }

  return <Dashboard />;
}

function Dashboard() {
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
  const [createFirstError, setCreateFirstError] = useState<string | null>(null);

  const activePanel = panels[activePanelIndex];

  useEffect(() => {
    if (panels.length > 0 && activePanelIndex >= panels.length) {
      setActivePanelIndex(0);
    }
  }, [panels.length, activePanelIndex, setActivePanelIndex]);

  const showSaved = () => {
    setSavedKey('main');
    setTimeout(() => setSavedKey(null), 1800);
  };

  const handleCreateFirstTab = () => {
    setCreateFirstError(null);
    createPanel.mutate(
      { name: 'New Tab' },
      {
        onSuccess: async () => {
          // Ensure fresh list lands before selecting index.
          await panelsQuery.refetch();
          setActivePanelIndex(0);
        },
        onError: (err) => {
          setCreateFirstError(err instanceof Error ? err.message : 'Failed to create first tab');
        },
      }
    );
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
          <div className="w-full max-w-sm text-center">
            <p className="text-sm text-white/50">No tabs yet</p>
            <p className="mt-1 text-xs text-white/40">Use the <span className="text-white/60">+</span> button below to add a tab.</p>
            <button
              type="button"
              onClick={handleCreateFirstTab}
              disabled={createPanel.isPending}
              className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white/90 disabled:opacity-50"
              title="Add tab"
            >
              {createPanel.isPending ? 'Adding…' : 'Add tab'}
            </button>
            {panelsQuery.isError && (
              <p className="mt-4 text-[10px] text-white/35">
                Couldn’t load tabs.{' '}
                <button type="button" onClick={() => panelsQuery.refetch()} className="underline hover:text-white/60">Retry</button>
              </p>
            )}
            {createFirstError && (
              <p className="mt-3 text-[10px] text-red-400/80">{createFirstError}</p>
            )}
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
