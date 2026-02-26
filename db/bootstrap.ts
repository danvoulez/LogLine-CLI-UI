import { sql } from './index';

let initPromise: Promise<void> | null = null;

export async function ensureDbSchema(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await sql`
        create table if not exists panels (
          panel_id text primary key,
          workspace_id text not null default 'default',
          name text not null,
          position integer not null default 0,
          version text not null default '1.0.0',
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );
      `;

      await sql`alter table panels add column if not exists workspace_id text not null default 'default';`;

      await sql`
        create table if not exists panel_components (
          instance_id text primary key,
          panel_id text not null references panels(panel_id) on delete cascade,
          component_id text not null,
          version text not null default '1.0.0',
          rect_x integer not null default 0,
          rect_y integer not null default 0,
          rect_w integer not null default 8,
          rect_h integer not null default 8,
          front_props text not null default '{}',
          position integer not null default 0,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );
      `;

      await sql`
        create table if not exists instance_configs (
          instance_id text primary key references panel_components(instance_id) on delete cascade,
          source_hub text,
          source_origin text,
          source_auth_ref text,
          source_mode text,
          source_interval_ms integer,
          proc_executor text,
          proc_command text,
          proc_args text default '[]',
          proc_timeout_ms integer,
          proc_retries integer,
          proc_backoff text,
          proc_error_mode text,
          updated_at timestamptz not null default now()
        );
      `;

      await sql`
        create table if not exists installed_components (
          component_id text primary key,
          installed_at timestamptz not null default now()
        );
      `;

      await sql`
        create table if not exists tab_meta (
          panel_id text primary key references panels(panel_id) on delete cascade,
          icon text,
          label text,
          shortcut integer
        );
      `;

      await sql`
        create table if not exists panel_settings (
          panel_id text primary key references panels(panel_id) on delete cascade,
          settings text not null default '{}',
          updated_at timestamptz not null default now()
        );
      `;

      await sql`
        create table if not exists chat_messages (
          id text primary key,
          workspace_id text not null default 'default',
          session_id text not null,
          panel_id text,
          instance_id text,
          role text not null,
          content text not null,
          model_used text,
          latency_ms integer,
          created_at timestamptz not null default now()
        );
      `;
      await sql`alter table chat_messages add column if not exists workspace_id text not null default 'default';`;

      await sql`
        create table if not exists app_settings (
          key text primary key,
          value text not null,
          updated_at timestamptz not null default now()
        );
      `;

      await sql`
        create table if not exists service_status_log (
          id serial primary key,
          service_name text not null,
          status text not null,
          latency_ms integer,
          recorded_at timestamptz not null default now()
        );
      `;

      await sql`create index if not exists idx_panels_workspace_position on panels (workspace_id, position);`;
      await sql`create index if not exists idx_chat_workspace_session_created on chat_messages (workspace_id, session_id, created_at);`;
    })();
  }

  await initPromise;
}
