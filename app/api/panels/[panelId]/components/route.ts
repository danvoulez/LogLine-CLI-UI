import { NextRequest, NextResponse } from 'next/server';
import { callLogline } from '@/lib/api/logline-client';

type Params = { params: Promise<{ panelId: string }> };

// GET /api/panels/[panelId]/components
// Rust-owned endpoint: proxy request to logline-daemon /v1/panels/:panelId/components.
export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { panelId } = await params;
  const search = req.nextUrl.search || '';

  try {
    const upstream = await callLogline(req, `/v1/panels/${panelId}/components${search}`, 'GET');
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
        detail: error instanceof Error ? error.message : 'unknown error',
      },
      { status: 502 }
    );
  }
}

// POST /api/panels/[panelId]/components
// Rust-owned endpoint: proxy request to logline-daemon /v1/panels/:panelId/components.
export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { panelId } = await params;
  const search = req.nextUrl.search || '';

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const upstream = await callLogline(req, `/v1/panels/${panelId}/components${search}`, 'POST', body);
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
        detail: error instanceof Error ? error.message : 'unknown error',
      },
      { status: 502 }
    );
  }
}
