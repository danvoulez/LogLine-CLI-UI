import { NextRequest, NextResponse } from 'next/server';
import { callLogline } from '@/lib/api/logline-client';

// POST /api/v1/cli/auth/challenge
// Rust-owned endpoint: proxy request to logline-daemon /v1/cli/auth/challenge.
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown = undefined;
  try {
    body = await req.json();
  } catch {
    body = undefined;
  }

  try {
    const upstream = await callLogline(req, '/v1/cli/auth/challenge', 'POST', body);
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
