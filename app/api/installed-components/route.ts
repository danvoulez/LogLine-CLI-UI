import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/index';
import { installedComponents } from '@/db/schema';

// GET /api/installed-components
export async function GET(): Promise<NextResponse> {
  try {
    const rows = db.select().from(installedComponents).all();
    return NextResponse.json(rows);
  } catch (err) {
    console.error('[GET /api/installed-components]', err);
    return NextResponse.json({ error: 'Failed to fetch installed components' }, { status: 500 });
  }
}

// POST /api/installed-components
// Body: { componentId: string }
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json() as { componentId: string };
    const row = {
      component_id: body.componentId,
      installed_at: new Date(),
    };
    db.insert(installedComponents)
      .values(row)
      .onConflictDoUpdate({ target: installedComponents.component_id, set: row })
      .run();
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error('[POST /api/installed-components]', err);
    return NextResponse.json({ error: 'Failed to install component' }, { status: 500 });
  }
}
