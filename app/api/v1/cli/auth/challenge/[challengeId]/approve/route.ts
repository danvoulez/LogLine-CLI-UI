import { NextRequest, NextResponse } from 'next/server';
import { callLogline } from '@/lib/api/logline-client';

// POST /api/v1/cli/auth/challenge/:challengeId/approve
// Rust-owned endpoint: proxy request to logline-daemon /v1/cli/auth/challenge/:challengeId/approve.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ challengeId: string }> }
): Promise<NextResponse> {
  const { challengeId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const upstream = await callLogline(req, `/v1/cli/auth/challenge/${challengeId}/approve`, 'POST', body);
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
