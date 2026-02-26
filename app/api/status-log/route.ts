import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/index';
import { serviceStatusLog } from '@/db/schema';
import { desc } from 'drizzle-orm';

// GET /api/status-log?limit=50
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const limitParam = req.nextUrl.searchParams.get('limit');
    const limit = Math.min(parseInt(limitParam ?? '50', 10), 500);

    const rows = db
      .select()
      .from(serviceStatusLog)
      .orderBy(desc(serviceStatusLog.recorded_at))
      .limit(limit)
      .all();

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

    db.insert(serviceStatusLog).values(row).run();
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/status-log]', err);
    return NextResponse.json({ error: 'Failed to log status' }, { status: 500 });
  }
}
