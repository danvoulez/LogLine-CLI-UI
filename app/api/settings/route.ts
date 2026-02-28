import { NextRequest, NextResponse } from 'next/server';
import { callLogline } from '@/lib/api/logline-client';

// GET /api/settings
// Rust-owned endpoint: proxy request to logline-daemon /v1/settings.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const search = req.nextUrl.search || '';
  try {
    const upstream = await callLogline(req, `/v1/settings${search}`, 'GET');
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

// PATCH /api/settings
// Rust-owned endpoint: proxy request to logline-daemon /v1/settings.
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const search = req.nextUrl.search || '';

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const upstream = await callLogline(req, `/v1/settings${search}`, 'PATCH', body);
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
