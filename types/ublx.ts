import { Type } from "@google/genai";

export type ComponentId = string;
export type Version = string;
export type SizePresetId = 'S' | 'M' | 'L' | 'XL' | 'WIDE';

export interface ComponentManifest {
  component_id: ComponentId;
  name: string;
  version: Version;
  frontend_entry: string;
  permissions: string[];
  required_binding_tags?: string[];
  optional_binding_tags?: string[];
  settings_schema_ref?: string;
  source_schema_ref?: string;
  processing_schema_ref?: string;
  allowed_size_presets?: SizePresetId[];
  default_size_preset?: SizePresetId;
  limits: {
    min_w: number;
    min_h: number;
    max_w: number;
    max_h: number;
  };
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PanelComponentInstance {
  instance_id: string;
  component_id: ComponentId;
  version: Version;
  rect: Rect;
  front_props?: Record<string, any>;
  back_config_ref?: string;
}

export interface PanelManifest {
  panel_id: string;
  name: string;
  version: Version;
  layout_grid: { rows: 24; cols: 32 };
  components: PanelComponentInstance[];
}

export type HubType = 'websocket' | 'webhook' | 'grpc' | 'http_api' | 'file_watch' | 'internal_bus';

export interface ComponentConfig {
  source: {
    tipo_hub: HubType;
    origem: string;
    auth_ref?: string;
    polling_ou_stream: 'polling' | 'stream';
    intervalo_ms?: number;
  };
  processing: {
    executor: 'ublx';
    comando_base: string;
    argumentos_template: string[];
    timeout_ms: number;
    retries: number;
    backoff: 'linear' | 'exponential';
    modo_erro: 'stop' | 'continue' | 'retry';
  };
}

export type ServiceStatus = 'ok' | 'warn' | 'fail';
export type GlobalStatus = 'healthy' | 'degraded' | 'offline';

export interface AppSettings {
  api_base_url: string;
  ws_url: string;
  use_mocks: boolean;
  theme: 'dark' | 'light';
}

export interface EffectiveConfig {
  instance_id: string;
  panel_id: string;
  component_id?: string;
  layers: {
    app: Record<string, unknown>;
    panel: Record<string, unknown>;
    instance: Record<string, unknown>;
  };
  effective: Record<string, unknown>;
  bindings?: Record<string, unknown>;
  binding_sources?: Record<string, { source: 'instance' | 'panel' | 'app'; matched_tag: string }>;
  missing_required_tags?: string[];
}
