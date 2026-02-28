import { NextRequest, NextResponse } from 'next/server';
import { callLogline } from '@/lib/api/logline-client';

type Params = { params: Promise<{ path: string[] }> };
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// Rust-owned endpoint: proxy request to logline-daemon /v1/llm-gateway/*.
async function proxy(req: NextRequest, { params }: Params, method: Method): Promise<NextResponse> {
  const { path } = await params;
  const pathname = path.length > 0 ? `/${path.join('/')}` : '';
  const search = req.nextUrl.search || '';

  let body: unknown = undefined;
  if (method !== 'GET') {
    try {
      body = await req.json();
    } catch {
      body = undefined;
    }
  }

  try {
    const upstream = await callLogline(req, `/v1/llm-gateway${pathname}${search}`, method, body);
    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type') || 'application/json';
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

export async function GET(req: NextRequest, ctx: Params): Promise<NextResponse> {
  return proxy(req, ctx, 'GET');
}

export async function POST(req: NextRequest, ctx: Params): Promise<NextResponse> {
  return proxy(req, ctx, 'POST');
}

export async function PUT(req: NextRequest, ctx: Params): Promise<NextResponse> {
  return proxy(req, ctx, 'PUT');
}

export async function PATCH(req: NextRequest, ctx: Params): Promise<NextResponse> {
  return proxy(req, ctx, 'PATCH');
}

export async function DELETE(req: NextRequest, ctx: Params): Promise<NextResponse> {
  return proxy(req, ctx, 'DELETE');
}
