import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/index';
import { appSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/settings
export async function GET(): Promise<NextResponse> {
  try {
    const rows = db.select().from(appSettings).all();
    const result = Object.fromEntries(
      rows.map((r) => [r.key, JSON.parse(r.value) as unknown])
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
    const body = await req.json() as { key: string; value: unknown };
    const row = {
      key:        body.key,
      value:      JSON.stringify(body.value),
      updated_at: new Date(),
    };
    db.insert(appSettings)
      .values(row)
      .onConflictDoUpdate({ target: appSettings.key, set: row })
      .run();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[PATCH /api/settings]', err);
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
  }
}
