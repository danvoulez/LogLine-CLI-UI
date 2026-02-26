import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/index';
import { ensureDbSchema } from '@/db/bootstrap';
import { serviceStatusLog } from '@/db/schema';
import { desc } from 'drizzle-orm';

// GET /api/status-log?limit=50
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await ensureDbSchema();
    const limitParam = req.nextUrl.searchParams.get('limit');
    const limit = Math.min(parseInt(limitParam ?? '50', 10), 500);

    const rows = await db
      .select()
      .from(serviceStatusLog)
      .orderBy(desc(serviceStatusLog.recorded_at))
      .limit(limit)
      ;

    return NextResponse.json(rows);
  } catch (err) {
    console.error('[GET /api/status-log]', err);
    return NextResponse.json({ error: 'Failed to fetch status log' }, { status: 500 });
  }
}

// POST /api/status-log
// Body: { service_name: string; status: string; latency_ms?: number }
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await ensureDbSchema();
    const body = await req.json() as {
      service_name: string;
      status:       string;
      latency_ms?:  number;
    };

    const row = {
      service_name: body.service_name,
      status:       body.status,
      latency_ms:   body.latency_ms ?? null,
      recorded_at:  new Date(),
    };

    await db.insert(serviceStatusLog).values(row);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/status-log]', err);
    return NextResponse.json({ error: 'Failed to log status' }, { status: 500 });
  }
}
