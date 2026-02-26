import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/index';
import { ensureDbSchema } from '@/db/bootstrap';
import { installedComponents } from '@/db/schema';
import { like } from 'drizzle-orm';
import { resolveWorkspaceId } from '@/lib/auth/workspace';

// GET /api/installed-components
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await ensureDbSchema();
    const workspaceId = resolveWorkspaceId(req);
    const prefix = `${workspaceId}::`;
    const rows = await db
      .select()
      .from(installedComponents)
      .where(like(installedComponents.component_id, `${prefix}%`));

    return NextResponse.json(
      rows.map((row) => ({
        ...row,
        component_id: row.component_id.slice(prefix.length),
      }))
    );
  } catch (err) {
    console.error('[GET /api/installed-components]', err);
    return NextResponse.json({ error: 'Failed to fetch installed components' }, { status: 500 });
  }
}

// POST /api/installed-components
// Body: { componentId: string }
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await ensureDbSchema();
    const workspaceId = resolveWorkspaceId(req);
    const body = await req.json() as { componentId: string };
    const row = {
      component_id: `${workspaceId}::${body.componentId}`,
      installed_at: new Date(),
    };
    await db.insert(installedComponents)
      .values(row)
      .onConflictDoUpdate({ target: installedComponents.component_id, set: row });
    return NextResponse.json({ component_id: body.componentId, installed_at: row.installed_at }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/installed-components]', err);
    return NextResponse.json({ error: 'Failed to install component' }, { status: 500 });
  }
}
