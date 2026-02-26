import { NextRequest } from 'next/server';

export type LoglineMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

function resolveDaemonBaseUrl(): string {
  return (
    process.env.LOGLINE_DAEMON_URL ||
    process.env.NEXT_PUBLIC_LOGLINE_DAEMON_URL ||
    'http://127.0.0.1:7600'
  ).replace(/\/$/, '');
}

function resolveToken(req?: NextRequest): string | null {
  const incoming = req?.headers.get('x-logline-token') || req?.headers.get('authorization');
  if (incoming?.startsWith('Bearer ')) {
    return incoming.slice('Bearer '.length).trim();
  }
  if (incoming) {
    return incoming;
  }
  return process.env.LOGLINE_DAEMON_TOKEN ?? null;
}

export async function callLogline(
  req: NextRequest | undefined,
  path: string,
  method: LoglineMethod,
  body?: unknown
): Promise<Response> {
  const baseUrl = resolveDaemonBaseUrl();
  const token = resolveToken(req);

  const headers = new Headers();
  headers.set('accept', 'application/json');
  if (token) {
    headers.set('x-logline-token', token);
  }
  if (body !== undefined) {
    headers.set('content-type', 'application/json');
  }

  return fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
}
