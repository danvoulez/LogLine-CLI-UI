import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/index';
import { ensureDbSchema } from '@/db/bootstrap';
import { chatMessages } from '@/db/schema';
import { eq, asc, and } from 'drizzle-orm';
import { resolveWorkspaceId } from '@/lib/auth/workspace';

// GET /api/chat?session_id=...
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await ensureDbSchema();
    const workspaceId = resolveWorkspaceId(req);
    const sessionId = req.nextUrl.searchParams.get('session_id');
    if (!sessionId) {
      return NextResponse.json({ error: 'session_id required' }, { status: 400 });
    }

    const rows = await db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.workspace_id, workspaceId), eq(chatMessages.session_id, sessionId)))
      .orderBy(asc(chatMessages.created_at))
      ;

    return NextResponse.json(rows);
  } catch (err) {
    console.error('[GET /api/chat]', err);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

// POST /api/chat
// Body: { session_id, role, content, panel_id?, instance_id?, model_used?, latency_ms? }
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await ensureDbSchema();
    const workspaceId = resolveWorkspaceId(req);
    const body = await req.json() as {
      session_id:   string;
      role:         'user' | 'assistant';
      content:      string;
      panel_id?:    string;
      instance_id?: string;
      model_used?:  string;
      latency_ms?:  number;
    };

    const row = {
      id:          crypto.randomUUID(),
      workspace_id: workspaceId,
      session_id:  body.session_id,
      panel_id:    body.panel_id    ?? null,
      instance_id: body.instance_id ?? null,
      role:        body.role,
      content:     body.content,
      model_used:  body.model_used  ?? null,
      latency_ms:  body.latency_ms  ?? null,
      created_at:  new Date(),
    };

    await db.insert(chatMessages).values(row);
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error('[POST /api/chat]', err);
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
  }
}
