import { NextRequest, NextResponse } from 'next/server';
import { callLogline } from '@/lib/api/logline-client';

type Params = { params: Promise<{ instanceId: string }> };

// GET /api/effective-config/[instanceId]
// Rust-owned endpoint: proxy request to logline-daemon /v1/effective-config/:instanceId.
export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const search = req.nextUrl.search || '';
  const { instanceId } = await params;

  try {
    const upstream = await callLogline(req, `/v1/effective-config/${instanceId}${search}`, 'GET');
    const contentType = upstream.headers.get('content-type') || 'application/json';
    const text = await upstream.text();

    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        'content-type': contentType,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to reach logline daemon',
      },
      { status: 502 }
    );
  }
}
