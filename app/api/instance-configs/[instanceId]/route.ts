import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/index';
import { ensureDbSchema } from '@/db/bootstrap';
import { instanceConfigs, panelComponents, panels } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { resolveWorkspaceId } from '@/lib/auth/workspace';

type Params = { params: Promise<{ instanceId: string }> };

// GET /api/instance-configs/[instanceId]
export async function GET(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    await ensureDbSchema();
    const workspaceId = resolveWorkspaceId(_req);
    const { instanceId } = await params;
    const ownership = await db
      .select({ instance_id: panelComponents.instance_id })
      .from(panelComponents)
      .innerJoin(panels, eq(panelComponents.panel_id, panels.panel_id))
      .where(and(eq(panelComponents.instance_id, instanceId), eq(panels.workspace_id, workspaceId)))
      .limit(1);
    if (ownership.length === 0) return NextResponse.json(null);

    const rows = await db
      .select()
      .from(instanceConfigs)
      .where(eq(instanceConfigs.instance_id, instanceId))
      .limit(1);
    const row = rows[0];

    if (!row) return NextResponse.json(null);

    return NextResponse.json({
      ...row,
      proc_args: JSON.parse(row.proc_args ?? '[]') as string[],
    });
  } catch (err) {
    console.error('[GET /api/instance-configs/:id]', err);
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
  }
}

// PUT /api/instance-configs/[instanceId] — upsert
export async function PUT(req: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    await ensureDbSchema();
    const workspaceId = resolveWorkspaceId(req);
    const { instanceId } = await params;
    const ownership = await db
      .select({ instance_id: panelComponents.instance_id })
      .from(panelComponents)
      .innerJoin(panels, eq(panelComponents.panel_id, panels.panel_id))
      .where(and(eq(panelComponents.instance_id, instanceId), eq(panels.workspace_id, workspaceId)))
      .limit(1);
    if (ownership.length === 0) {
      return NextResponse.json({ error: 'Instance not found in workspace' }, { status: 404 });
    }

    const body = await req.json() as {
      source_hub?:         string;
      source_origin?:      string;
      source_auth_ref?:    string;
      source_mode?:        string;
      source_interval_ms?: number;
      proc_executor?:      string;
      proc_command?:       string;
      proc_args?:          string[];
      proc_timeout_ms?:    number;
      proc_retries?:       number;
      proc_backoff?:       string;
      proc_error_mode?:    string;
    };

    const row = {
      instance_id:        instanceId,
      source_hub:         body.source_hub         ?? null,
      source_origin:      body.source_origin       ?? null,
      source_auth_ref:    body.source_auth_ref     ?? null,
      source_mode:        body.source_mode         ?? null,
      source_interval_ms: body.source_interval_ms  ?? null,
      proc_executor:      body.proc_executor       ?? null,
      proc_command:       body.proc_command        ?? null,
      proc_args:          JSON.stringify(body.proc_args ?? []),
      proc_timeout_ms:    body.proc_timeout_ms     ?? null,
      proc_retries:       body.proc_retries        ?? null,
      proc_backoff:       body.proc_backoff        ?? null,
      proc_error_mode:    body.proc_error_mode     ?? null,
      updated_at:         new Date(),
    };

    await db.insert(instanceConfigs)
      .values(row)
      .onConflictDoUpdate({ target: instanceConfigs.instance_id, set: row });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[PUT /api/instance-configs/:id]', err);
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
  }
}
