'use client';

import React, { useMemo, useState } from 'react';
import { Send } from 'lucide-react';
import { useChatHistory, useSendChatMessage, useGatewayChatCompletion } from '@/lib/api/db-hooks';
import { resolveBindingValue, resolveChatCascadeSettings } from '@/lib/config/component-settings';

type ChatAIProps = {
  session_id?: string;
  panel_id?: string;
  instance_id?: string;
  effective?: Record<string, unknown>;
  bindings?: Record<string, unknown>;
  missing_required_tags?: string[];
};

export function ChatAI(props: ChatAIProps) {
  const chatSettings = resolveChatCascadeSettings(props.effective ?? {});
  const bindings = props.bindings ?? {};
  const llmProvider = resolveBindingValue(bindings, ['llm:provider']) as string | undefined;
  const hasLlmApiKey = resolveBindingValue(bindings, ['llm:api_key']) !== undefined;
  const gatewayBase = resolveBindingValue(bindings, ['backend:llm_gateway:url']) as string | undefined;
  const gatewayToken = resolveBindingValue(bindings, ['secret:llm_gateway:key']) as string | undefined;
  const fallbackSession = useMemo(() => {
    const panel = props.panel_id ?? 'panel';
    const instance = props.instance_id ?? 'instance';
    return `chat-${panel}-${instance}`;
  }, [props.panel_id, props.instance_id]);

  const sessionId = props.session_id ?? chatSettings.session_id ?? fallbackSession;
  const history = useChatHistory(sessionId);
  const send = useSendChatMessage();
  const gatewayChat = useGatewayChatCompletion();
  const [draft, setDraft] = useState('');

  const onSend = () => {
    const content = draft.trim();
    if (!content) return;

    send.mutate(
      {
        session_id: sessionId,
        panel_id: props.panel_id,
        instance_id: props.instance_id,
        role: 'user',
        content,
      },
      {
        onSuccess: () => {
          setDraft('');
          if (gatewayBase && gatewayToken) {
            const pastMessages = (history.data ?? []).map((msg) => ({
              role: msg.role,
              content: msg.content,
            })) as { role: 'user' | 'assistant'; content: string }[];

            gatewayChat.mutate(
              {
                baseUrl: gatewayBase,
                token: gatewayToken,
                model: 'auto',
                messages: [...pastMessages, { role: 'user', content }],
              },
              {
                onSuccess: (resp) => {
                  const choices = Array.isArray(resp.choices) ? (resp.choices as Record<string, unknown>[]) : [];
                  const first = choices[0];
                  const message = first?.message as Record<string, unknown> | undefined;
                  const assistantText =
                    typeof message?.content === 'string'
                      ? message.content
                      : `${chatSettings.assistant_prefix}: ${content}`;

                  send.mutate({
                    session_id: sessionId,
                    panel_id: props.panel_id,
                    instance_id: props.instance_id,
                    role: 'assistant',
                    content: assistantText,
                    model_used: typeof resp.model === 'string' ? resp.model : undefined,
                  });
                },
                onError: () => {
                  if (chatSettings.auto_reply) {
                    send.mutate({
                      session_id: sessionId,
                      panel_id: props.panel_id,
                      instance_id: props.instance_id,
                      role: 'assistant',
                      content: `${chatSettings.assistant_prefix}: ${content}`,
                    });
                  }
                },
              }
            );
            return;
          }

          if (chatSettings.auto_reply) {
            send.mutate({
              session_id: sessionId,
              panel_id: props.panel_id,
              instance_id: props.instance_id,
              role: 'assistant',
              content: `${chatSettings.assistant_prefix}: ${content}`,
            });
          }
        },
      }
    );
  };

  return (
    <div className="w-full h-full flex flex-col bg-white/[0.02] border border-white/10 rounded-lg p-2">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[9px] text-white/60 uppercase tracking-widest">Chat Session</h4>
        <span className="text-[8px] text-white/30 font-mono truncate max-w-[120px]">{sessionId}</span>
      </div>
      <div className="mb-2 text-[8px] text-white/45 flex items-center justify-between">
        <span>provider: {llmProvider ?? '-'}</span>
        <span>llm key: {hasLlmApiKey ? 'bound' : 'missing'}</span>
      </div>
      <div className="mb-2 text-[8px] text-white/35 flex items-center justify-between">
        <span>gateway: {gatewayBase ?? '-'}</span>
        <span>mode: {gatewayBase && gatewayToken ? 'live' : 'local-fallback'}</span>
      </div>
      {props.missing_required_tags && props.missing_required_tags.length > 0 && (
        <div className="mb-2 p-1.5 rounded border border-amber-400/20 bg-amber-400/10 text-[9px] text-amber-200">
          Missing tags: {props.missing_required_tags.join(', ')}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto space-y-1.5 pr-1">
        {(history.data ?? []).map((msg) => (
          <div
            key={msg.id}
            className={`p-2 rounded border text-[11px] leading-snug ${
              msg.role === 'user'
                ? 'bg-blue-500/10 border-blue-400/20 text-blue-100 ml-5'
                : 'bg-white/[0.03] border-white/10 text-white/85 mr-5'
            }`}
          >
            <div className="text-[8px] uppercase tracking-widest mb-1 opacity-70">{msg.role}</div>
            <div>{msg.content}</div>
          </div>
        ))}
        {history.isLoading && <div className="text-[10px] text-white/35">Loading messages...</div>}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSend();
          }}
          placeholder="Type a message"
          className="flex-1 bg-[#2a2a2a] border border-white/10 rounded px-2.5 py-2 text-xs focus:outline-none focus:border-white/30"
        />
        <button
          onClick={onSend}
          disabled={send.isPending}
          className="px-2.5 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40"
          title="Send"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
