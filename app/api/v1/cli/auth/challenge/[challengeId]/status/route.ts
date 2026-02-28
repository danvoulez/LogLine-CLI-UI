import { NextRequest, NextResponse } from 'next/server';
import { callLogline } from '@/lib/api/logline-client';

// GET /api/v1/cli/auth/challenge/:challengeId/status
// Rust-owned endpoint: proxy request to logline-daemon /v1/cli/auth/challenge/:challengeId/status.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ challengeId: string }> }
): Promise<NextResponse> {
  const { challengeId } = await params;

  try {
    const upstream = await callLogline(req, `/v1/cli/auth/challenge/${challengeId}/status`, 'GET');
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
