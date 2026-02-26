import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/index';
import { ensureDbSchema } from '@/db/bootstrap';
import { appSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { resolveWorkspaceId, toScopedKey } from '@/lib/auth/workspace';

type Params = { params: Promise<{ path: string[] }> };
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

function parseAllowedHosts(): Set<string> {
  const fromEnv = (process.env.LLM_GATEWAY_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  const out = new Set<string>(fromEnv);
  out.add('api.logline.world');
  if (process.env.NODE_ENV !== 'production') {
    out.add('localhost');
    out.add('127.0.0.1');
  }
  return out;
}

async function readWorkspaceGatewayUrl(req: NextRequest): Promise<string | null> {
  const workspaceId = resolveWorkspaceId(req);
  const key = toScopedKey(workspaceId, 'component_defaults');
  const rows = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  if (rows.length !== 1) return null;
  try {
    const parsed = JSON.parse(rows[0].value) as Record<string, unknown>;
    return typeof parsed.llm_gateway_base_url === 'string' ? parsed.llm_gateway_base_url.trim() : null;
  } catch {
    return null;
  }
}

function normalizeAndValidateBaseUrl(baseUrlRaw: string, allowedHosts: Set<string>): string | null {
  const baseUrl = baseUrlRaw.trim();
  if (!baseUrl) return null;
  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (!allowedHosts.has(parsed.hostname.toLowerCase())) return null;
    return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, '');
  } catch {
    return null;
  }
}

async function resolveBaseUrl(req: NextRequest): Promise<string | null> {
  const allowedHosts = parseAllowedHosts();
  const candidates = [
    req.headers.get('x-llm-gateway-base-url') ?? '',
    await readWorkspaceGatewayUrl(req) ?? '',
    process.env.LLM_GATEWAY_BASE_URL ?? '',
  ];
  for (const candidate of candidates) {
    const valid = normalizeAndValidateBaseUrl(candidate, allowedHosts);
    if (valid) return valid;
  }
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
  await ensureDbSchema();
  const baseUrl = await resolveBaseUrl(req);
  if (!baseUrl) {
    return NextResponse.json(
      {
        error: 'LLM gateway base URL is missing or not allowed',
        hint: 'Use app settings llm_gateway_base_url or LLM_GATEWAY_BASE_URL and allowlisted host',
      },
      { status: 400 }
    );
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
