import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ path: string[] }> };
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

function resolveBaseUrl(req: NextRequest): string | null {
  const fromHeader = req.headers.get('x-llm-gateway-base-url')?.trim();
  if (fromHeader) return fromHeader.replace(/\/$/, '');
  return null;
}

function resolveAuth(req: NextRequest): string | null {
  const bearer = req.headers.get('authorization')?.trim();
  if (bearer) return bearer;
  const token = req.headers.get('x-llm-gateway-token')?.trim();
  if (!token) return null;
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
}

async function proxy(req: NextRequest, { params }: Params, method: Method): Promise<NextResponse> {
  const baseUrl = resolveBaseUrl(req);
  if (!baseUrl) {
    return NextResponse.json({ error: 'Missing x-llm-gateway-base-url header' }, { status: 400 });
  }

  const { path } = await params;
  const pathname = `/${path.join('/')}`;
  const search = req.nextUrl.search || '';

  let body: unknown = undefined;
  if (method !== 'GET') {
    try {
      body = await req.json();
    } catch {
      body = undefined;
    }
  }

  const headers = new Headers();
  const auth = resolveAuth(req);
  if (auth) headers.set('authorization', auth);
  headers.set('accept', 'application/json, text/plain;q=0.9, */*;q=0.8');
  if (body !== undefined) headers.set('content-type', 'application/json');

  try {
    const upstream = await fetch(`${baseUrl}${pathname}${search}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });

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
        error: 'Failed to reach llm gateway',
        detail: error instanceof Error ? error.message : 'unknown error',
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
