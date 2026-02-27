import { NextRequest, NextResponse } from 'next/server';
import { callLogline } from '@/lib/api/logline-client';

type Params = { params: Promise<{ componentId: string }> };

// DELETE /api/installed-components/[componentId]
// Rust-owned endpoint: proxy request to logline-daemon /v1/installed-components/:componentId.
export async function DELETE(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { componentId } = await params;
  const search = req.nextUrl.search || '';

  try {
    const upstream = await callLogline(req, `/v1/installed-components/${componentId}${search}`, 'DELETE');
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
