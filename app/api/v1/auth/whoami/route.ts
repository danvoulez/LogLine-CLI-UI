import { NextRequest, NextResponse } from 'next/server';
import { callLogline } from '@/lib/api/logline-client';

// GET /api/v1/auth/whoami
// Rust-owned endpoint: proxy request to logline-daemon /v1/auth/whoami.
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const upstream = await callLogline(req, '/v1/auth/whoami', 'GET');
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
