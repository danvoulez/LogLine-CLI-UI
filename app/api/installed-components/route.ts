import { NextRequest, NextResponse } from 'next/server';
import { callLogline } from '@/lib/api/logline-client';

// GET /api/installed-components
// Rust-owned endpoint: proxy request to logline-daemon /v1/installed-components.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const search = req.nextUrl.search || '';
  try {
    const upstream = await callLogline(req, `/v1/installed-components${search}`, 'GET');
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

// POST /api/installed-components
// Rust-owned endpoint: proxy request to logline-daemon /v1/installed-components.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const search = req.nextUrl.search || '';

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const upstream = await callLogline(req, `/v1/installed-components${search}`, 'POST', body);
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
