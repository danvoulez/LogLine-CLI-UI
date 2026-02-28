import { NextRequest, NextResponse } from 'next/server';
import { callLogline, type LoglineMethod } from '@/lib/api/logline-client';
import { AccessDeniedError, requireAccess } from '@/lib/auth/access';

type Params = { params: Promise<{ path: string[] }> };

async function proxy(req: NextRequest, { params }: Params, method: LoglineMethod): Promise<NextResponse> {
  const permission = method === 'GET' ? 'read' : 'write';
  try {
    await requireAccess(req, permission);
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const { path } = await params;
  const pathname = `/${path.join('/')}`;
  if (pathname === '/v1/auth/session' || pathname.startsWith('/v1/auth/session/')) {
    return NextResponse.json({ error: 'Forbidden route' }, { status: 403 });
  }
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
    const upstream = await callLogline(req, `${pathname}${search}`, method, body);
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
    console.error('[api/logline proxy]', error);
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

export async function OPTIONS(req: NextRequest): Promise<NextResponse> {
  void req;
  return new NextResponse(null, { status: 204 });
}
