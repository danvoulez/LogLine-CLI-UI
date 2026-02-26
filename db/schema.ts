import {
  sqliteTable,
  text,
  integer,
} from 'drizzle-orm/sqlite-core';

// ─── 1. panels ───────────────────────────────────────────────────────────────
export const panels = sqliteTable('panels', {
  panel_id:   text('panel_id').primaryKey(),
  name:       text('name').notNull(),
  position:   integer('position').notNull().default(0),
  version:    text('version').notNull().default('1.0.0'),
  created_at: integer('created_at', { mode: 'timestamp_ms' })
                .notNull()
                .$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp_ms' })
                .notNull()
                .$defaultFn(() => new Date()),
});

// ─── 2. panel_components ─────────────────────────────────────────────────────
export const panelComponents = sqliteTable('panel_components', {
  instance_id:  text('instance_id').primaryKey(),
  panel_id:     text('panel_id')
                  .notNull()
                  .references(() => panels.panel_id, { onDelete: 'cascade' }),
  component_id: text('component_id').notNull(),
  version:      text('version').notNull().default('1.0.0'),
  rect_x:       integer('rect_x').notNull().default(0),
  rect_y:       integer('rect_y').notNull().default(0),
  rect_w:       integer('rect_w').notNull().default(8),
  rect_h:       integer('rect_h').notNull().default(8),
  front_props:  text('front_props').notNull().default('{}'),
  position:     integer('position').notNull().default(0),
  created_at:   integer('created_at', { mode: 'timestamp_ms' })
                  .notNull()
                  .$defaultFn(() => new Date()),
  updated_at:   integer('updated_at', { mode: 'timestamp_ms' })
                  .notNull()
                  .$defaultFn(() => new Date()),
});

// ─── 3. instance_configs ─────────────────────────────────────────────────────
export const instanceConfigs = sqliteTable('instance_configs', {
  instance_id:        text('instance_id')
                        .primaryKey()
                        .references(() => panelComponents.instance_id, { onDelete: 'cascade' }),
  source_hub:         text('source_hub'),
  source_origin:      text('source_origin'),
  source_auth_ref:    text('source_auth_ref'),
  source_mode:        text('source_mode'),
  source_interval_ms: integer('source_interval_ms'),
  proc_executor:      text('proc_executor'),
  proc_command:       text('proc_command'),
  proc_args:          text('proc_args').default('[]'),
  proc_timeout_ms:    integer('proc_timeout_ms'),
  proc_retries:       integer('proc_retries'),
  proc_backoff:       text('proc_backoff'),
  proc_error_mode:    text('proc_error_mode'),
  updated_at:         integer('updated_at', { mode: 'timestamp_ms' })
                        .notNull()
                        .$defaultFn(() => new Date()),
});

// ─── 4. installed_components ─────────────────────────────────────────────────
export const installedComponents = sqliteTable('installed_components', {
  component_id: text('component_id').primaryKey(),
  installed_at: integer('installed_at', { mode: 'timestamp_ms' })
                  .notNull()
                  .$defaultFn(() => new Date()),
});

// ─── 5. tab_meta ─────────────────────────────────────────────────────────────
export const tabMeta = sqliteTable('tab_meta', {
  panel_id: text('panel_id')
              .primaryKey()
              .references(() => panels.panel_id, { onDelete: 'cascade' }),
  icon:     text('icon'),
  label:    text('label'),
  shortcut: integer('shortcut'),
});

// ─── 6. panel_settings ───────────────────────────────────────────────────────
export const panelSettings = sqliteTable('panel_settings', {
  panel_id:    text('panel_id')
                 .primaryKey()
                 .references(() => panels.panel_id, { onDelete: 'cascade' }),
  settings:    text('settings').notNull().default('{}'),
  updated_at:  integer('updated_at', { mode: 'timestamp_ms' })
                 .notNull()
                 .$defaultFn(() => new Date()),
});

// ─── 7. chat_messages ────────────────────────────────────────────────────────
export const chatMessages = sqliteTable('chat_messages', {
  id:          text('id').primaryKey(),
  session_id:  text('session_id').notNull(),
  panel_id:    text('panel_id'),
  instance_id: text('instance_id'),
  role:        text('role').notNull(),
  content:     text('content').notNull(),
  model_used:  text('model_used'),
  latency_ms:  integer('latency_ms'),
  created_at:  integer('created_at', { mode: 'timestamp_ms' })
                 .notNull()
                 .$defaultFn(() => new Date()),
});

// ─── 8. app_settings ─────────────────────────────────────────────────────────
export const appSettings = sqliteTable('app_settings', {
  key:        text('key').primaryKey(),
  value:      text('value').notNull(),
  updated_at: integer('updated_at', { mode: 'timestamp_ms' })
                .notNull()
                .$defaultFn(() => new Date()),
});

// ─── 9. service_status_log ───────────────────────────────────────────────────
export const serviceStatusLog = sqliteTable('service_status_log', {
  id:           integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  service_name: text('service_name').notNull(),
  status:       text('status').notNull(),
  latency_ms:   integer('latency_ms'),
  recorded_at:  integer('recorded_at', { mode: 'timestamp_ms' })
                  .notNull()
                  .$defaultFn(() => new Date()),
});

// ─── Inferred types ───────────────────────────────────────────────────────────
export type Panel              = typeof panels.$inferSelect;
export type NewPanel           = typeof panels.$inferInsert;
export type PanelComponent     = typeof panelComponents.$inferSelect;
export type NewPanelComponent  = typeof panelComponents.$inferInsert;
export type InstanceConfig     = typeof instanceConfigs.$inferSelect;
export type NewInstanceConfig  = typeof instanceConfigs.$inferInsert;
export type InstalledComponent = typeof installedComponents.$inferSelect;
export type TabMeta            = typeof tabMeta.$inferSelect;
export type PanelSettings      = typeof panelSettings.$inferSelect;
export type ChatMessage        = typeof chatMessages.$inferSelect;
export type NewChatMessage     = typeof chatMessages.$inferInsert;
export type AppSetting         = typeof appSettings.$inferSelect;
export type ServiceStatusEntry = typeof serviceStatusLog.$inferSelect;
