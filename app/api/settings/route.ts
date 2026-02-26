import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/index';
import { ensureDbSchema } from '@/db/bootstrap';
import { appSettings } from '@/db/schema';
import { like } from 'drizzle-orm';
import { resolveWorkspaceId, toScopedKey } from '@/lib/auth/workspace';

// GET /api/settings
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await ensureDbSchema();
    const workspaceId = resolveWorkspaceId(req);
    const prefix = `ws:${workspaceId}:`;
    const rows = await db
      .select()
      .from(appSettings)
      .where(like(appSettings.key, `${prefix}%`));
    const result = Object.fromEntries(
      rows.map((r) => [r.key.slice(prefix.length), JSON.parse(r.value) as unknown])
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/settings]', err);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// PATCH /api/settings
// Body: { key: string; value: unknown }
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    await ensureDbSchema();
    const workspaceId = resolveWorkspaceId(req);
    const body = await req.json() as { key: string; value: unknown };
    const row = {
      key:        toScopedKey(workspaceId, body.key),
      value:      JSON.stringify(body.value),
      updated_at: new Date(),
    };
    await db.insert(appSettings)
      .values(row)
      .onConflictDoUpdate({ target: appSettings.key, set: row });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[PATCH /api/settings]', err);
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
  }
}
