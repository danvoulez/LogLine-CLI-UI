import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/index';
import { installedComponents } from '@/db/schema';
import { eq } from 'drizzle-orm';

type Params = { params: Promise<{ componentId: string }> };

// DELETE /api/installed-components/[componentId]
export async function DELETE(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    const { componentId } = await params;
    db.delete(installedComponents)
      .where(eq(installedComponents.component_id, componentId))
      .run();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/installed-components/:id]', err);
    return NextResponse.json({ error: 'Failed to uninstall component' }, { status: 500 });
  }
}
