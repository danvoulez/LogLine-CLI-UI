import { create } from 'zustand';
import type { GlobalStatus, ServiceStatus } from '@/types/ublx';

// ── Ephemeral UI state only ───────────────────────────────────────────────────
// All persistent data (panels, components, configs, installed) is now in SQLite
// via /api/* routes. Query via lib/api/db-hooks.ts (TanStack Query).

interface LLMProvider {
  name:       string;
  model:      string;
  status:     ServiceStatus;
  latency_ms: number;
  load_pct:   number;
}

interface ServiceHealthEntry {
  name:       string;
  status:     ServiceStatus;
  latency_ms: number;
}

interface UIState {
  // ── Navigation (ephemeral — resets on reload, that's fine) ─────────────────
  activePanelIndex: number;
  setActivePanelIndex: (index: number) => void;
  nextPanel: (totalPanels: number) => void;
  prevPanel: () => void;

  // ── Panel flip state (ephemeral) ────────────────────────────────────────────
  flippedPanels: Record<string, boolean>;
  toggleFlip: (panelId: string) => void;
  selectedInstanceByPanel: Record<string, string | null>;
  setSelectedInstance: (panelId: string, instanceId: string | null) => void;

  // ── Component Store overlay ─────────────────────────────────────────────────
  isStoreOpen:    boolean;
  isAppSettingsOpen: boolean;
  storeSearch:    string;
  storeFilter:    'all' | 'installed' | 'available';
  toggleStore:    () => void;
  toggleAppSettings: () => void;
  closeAppSettings: () => void;
  setStoreSearch: (s: string) => void;
  setStoreFilter: (f: 'all' | 'installed' | 'available') => void;

  // ── Live observability data (WS/polling, never persisted) ──────────────────
  globalStatus:    GlobalStatus;
  serviceStatuses: ServiceHealthEntry[];
  llmProviders:    LLMProvider[];
  wsConnected:     boolean;
  setGlobalStatus:    (status: GlobalStatus, services: ServiceHealthEntry[]) => void;
  setLLMProviders:    (providers: LLMProvider[]) => void;
  setWSConnected:     (connected: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activePanelIndex: 0,
  flippedPanels:    {},
  selectedInstanceByPanel: {},
  isStoreOpen:      false,
  isAppSettingsOpen: false,
  storeSearch:      '',
  storeFilter:      'all',
  globalStatus:     'healthy',
  serviceStatuses:  [],
  llmProviders:     [],
  wsConnected:      false,

  setActivePanelIndex: (index) =>
    set({ activePanelIndex: index, isStoreOpen: false }),

  nextPanel: (totalPanels) =>
    set((state) => ({
      activePanelIndex: Math.min(state.activePanelIndex + 1, totalPanels - 1),
    })),

  prevPanel: () =>
    set((state) => ({
      activePanelIndex: Math.max(state.activePanelIndex - 1, 0),
    })),

  toggleFlip: (panelId) =>
    set((state) => ({
      flippedPanels: {
        ...state.flippedPanels,
        [panelId]: !state.flippedPanels[panelId],
      },
    })),

  setSelectedInstance: (panelId, instanceId) =>
    set((state) => ({
      selectedInstanceByPanel: {
        ...state.selectedInstanceByPanel,
        [panelId]: instanceId,
      },
    })),

  toggleStore:    () => set((state) => ({ isStoreOpen: !state.isStoreOpen })),
  toggleAppSettings: () => set((state) => ({ isAppSettingsOpen: !state.isAppSettingsOpen })),
  closeAppSettings: () => set({ isAppSettingsOpen: false }),
  setStoreSearch: (s) => set({ storeSearch: s }),
  setStoreFilter: (f) => set({ storeFilter: f }),

  setGlobalStatus: (status, services) =>
    set({ globalStatus: status, serviceStatuses: services }),

  setLLMProviders: (providers) => set({ llmProviders: providers }),

  setWSConnected: (connected) => set({ wsConnected: connected }),
}));
