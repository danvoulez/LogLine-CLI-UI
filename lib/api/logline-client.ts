import { NextRequest } from 'next/server';

export type LoglineMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const DEFAULT_DAEMON_URL = 'https://logline.voulezvous.tv';

function resolveDaemonBaseUrl(): string {
  return (
    process.env.LOGLINE_DAEMON_URL ||
    process.env.NEXT_PUBLIC_LOGLINE_DAEMON_URL ||
    DEFAULT_DAEMON_URL
  ).replace(/\/$/, '');
}

function isDefaultDaemon(baseUrl: string): boolean {
  try {
    const u = new URL(baseUrl);
    const host = u.hostname.toLowerCase();
    return (
      host === '127.0.0.1' ||
      host === 'localhost' ||
      host === 'logline.voulezvous.tv'
    );
  } catch {
    return false;
  }
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
  let token = resolveToken(req);
  if (!token && isDefaultDaemon(baseUrl)) {
    token = 'dev-token';
  }

  const headers = new Headers();
  headers.set('accept', 'application/json');

  if (req) {
    const auth = req.headers.get('authorization');
    if (auth) {
      headers.set('authorization', auth);
    }

    const passThroughHeaders = [
      'x-user-id',
      'x-workspace-id',
      'x-app-id',
      'x-logline-token',
      'x-llm-gateway-base-url',
      'x-llm-gateway-token',
    ];
    for (const key of passThroughHeaders) {
      const value = req.headers.get(key);
      if (value) {
        headers.set(key, value);
      }
    }
  }

  if (!headers.get('x-logline-token') && token) {
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
