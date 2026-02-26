import { PanelManifest, ComponentManifest } from '@/types/ublx';

export const MOCK_COMPONENTS: ComponentManifest[] = [
  {
    component_id: 'service-card',
    name: 'Service Card',
    version: '1.0.0',
    frontend_entry: 'ServiceCard',
    permissions: [],
    allowed_size_presets: ['S', 'M', 'L'],
    default_size_preset: 'M',
    limits: { min_w: 4, min_h: 4, max_w: 12, max_h: 8 }
  },
  {
    component_id: 'drop-zone',
    name: 'Drop Zone',
    version: '1.0.0',
    frontend_entry: 'DropZone',
    permissions: ['file_access'],
    allowed_size_presets: ['L', 'XL'],
    default_size_preset: 'L',
    limits: { min_w: 8, min_h: 8, max_w: 32, max_h: 24 }
  },
  {
    component_id: 'llm-status',
    name: 'LLM Status',
    version: '1.0.0',
    frontend_entry: 'LLMStatus',
    permissions: [],
    optional_binding_tags: ['llm:api_key', 'llm:provider', 'transport:sse', 'transport:websocket'],
    allowed_size_presets: ['M', 'L', 'WIDE'],
    default_size_preset: 'WIDE',
    limits: { min_w: 6, min_h: 4, max_w: 16, max_h: 12 }
  },
  {
    component_id: 'quick-files',
    name: 'Quick Files',
    version: '1.2.0',
    frontend_entry: 'QuickFiles',
    permissions: ['file_read'],
    allowed_size_presets: ['L', 'XL'],
    default_size_preset: 'L',
    limits: { min_w: 8, min_h: 8, max_w: 32, max_h: 24 }
  },
  {
    component_id: 'registry',
    name: 'Gate Registry',
    version: '0.9.5',
    frontend_entry: 'Registry',
    permissions: ['network', 'storage'],
    allowed_size_presets: ['L', 'XL'],
    default_size_preset: 'XL',
    limits: { min_w: 12, min_h: 12, max_w: 32, max_h: 24 }
  },
  {
    component_id: 'pipeline-editor',
    name: 'Pipeline Editor',
    version: '2.1.0',
    frontend_entry: 'PipelineEditor',
    permissions: ['exec'],
    allowed_size_presets: ['XL', 'WIDE'],
    default_size_preset: 'XL',
    limits: { min_w: 16, min_h: 12, max_w: 32, max_h: 24 }
  },
  {
    component_id: 'smart-list',
    name: 'Smart List',
    version: '1.0.1',
    frontend_entry: 'SmartList',
    permissions: [],
    allowed_size_presets: ['M', 'L', 'WIDE'],
    default_size_preset: 'M',
    limits: { min_w: 6, min_h: 4, max_w: 16, max_h: 24 }
  },
  {
    component_id: 'chat-ai',
    name: 'Chat AI',
    version: '1.0.0',
    frontend_entry: 'ChatAI',
    permissions: ['llm'],
    required_binding_tags: ['llm:api_key'],
    optional_binding_tags: [
      'llm:provider',
      'backend:llm_gateway:url',
      'secret:llm_gateway:key',
      'transport:sse',
      'transport:webhook',
      'transport:websocket',
    ],
    allowed_size_presets: ['L', 'XL', 'WIDE'],
    default_size_preset: 'L',
    limits: { min_w: 8, min_h: 12, max_w: 24, max_h: 24 }
  },
  {
    component_id: 'observability-hub',
    name: 'Observability Hub',
    version: '1.0.0',
    frontend_entry: 'ObservabilityHub',
    permissions: ['network'],
    optional_binding_tags: [
      'backend:llm_gateway:url',
      'secret:llm_gateway:admin',
      'transport:sse',
      'transport:websocket',
      'transport:webhook',
    ],
    allowed_size_presets: ['L', 'XL', 'WIDE'],
    default_size_preset: 'WIDE',
    limits: { min_w: 12, min_h: 10, max_w: 32, max_h: 24 }
  },
  {
    component_id: 'secret-field',
    name: 'Secret Field',
    version: '1.0.0',
    frontend_entry: 'SecretField',
    permissions: ['secrets'],
    optional_binding_tags: ['secret:api', 'secret:llm'],
    allowed_size_presets: ['S', 'M', 'WIDE'],
    default_size_preset: 'S',
    limits: { min_w: 4, min_h: 2, max_w: 12, max_h: 4 }
  }
];

export const MOCK_PANELS: PanelManifest[] = [
  {
    panel_id: 'home',
    name: 'Main Workspace',
    version: '1.0.0',
    layout_grid: { rows: 24, cols: 32 },
    components: [
      {
        instance_id: 'global-health',
        component_id: 'service-card',
        version: '1.0.0',
        rect: { x: 0, y: 0, w: 16, h: 8 },
        front_props: { title: 'System Health', status: 'ok' }
      }
    ]
  },
  {
    panel_id: 'ops',
    name: 'Operations',
    version: '1.0.0',
    layout_grid: { rows: 24, cols: 32 },
    components: []
  }
];
