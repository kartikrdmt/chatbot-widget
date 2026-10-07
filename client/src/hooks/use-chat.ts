'use client';

import type { WidgetChatError, WidgetFeatures, WidgetMessage } from '@myra/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';

import { type ChatTransport, type ConnectionStatus, createChatTransport } from '@/lib/chat';

export interface ChatError {
  code: WidgetChatError['code'] | 'offline';
  message: string;
  retryUntil?: number;
}

export interface UseChatParams {
  sessionToken: string;
  apiUrl: string;
  greeting: string;
  features: WidgetFeatures;
  offlineMessage: string;
  onSessionExpired: () => void;
  onDisabled: () => void;
}

export interface UseChatResult {
  messages: WidgetMessage[];
  typing: boolean;
  status: ConnectionStatus;
  chatError: ChatError | null;
  sendMessage: (text: string) => void;
}

const buildMessage = (sender: WidgetMessage['sender'], text: string): WidgetMessage => ({
  id: crypto.randomUUID(),
  sender,
  text,
  createdAt: new Date().toISOString(),
});

export function useChat({
  sessionToken,
  apiUrl,
  greeting,
  features,
  offlineMessage,
  onSessionExpired,
  onDisabled,
}: UseChatParams): UseChatResult {
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [chatError, setChatError] = useState<ChatError | null>(null);

  const transportRef = useRef<ChatTransport | null>(null);
  const lastSentRef = useRef<{ text: string; clientMessageId: string } | null>(null);
  const awaitingReplyRef = useRef(false);
  const resendRef = useRef<{ text: string; clientMessageId: string } | null>(null);
  const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onSessionExpiredRef = useRef(onSessionExpired);
  const onDisabledRef = useRef(onDisabled);
  const greetingRef = useRef(greeting);
  const offlineMessageRef = useRef(offlineMessage);
  const featuresRef = useRef(features);
  useEffect(() => {
    onSessionExpiredRef.current = onSessionExpired;
  }, [onSessionExpired]);
  useEffect(() => {
    onDisabledRef.current = onDisabled;
  }, [onDisabled]);
  useEffect(() => {
    greetingRef.current = greeting;
  }, [greeting]);
  useEffect(() => {
    offlineMessageRef.current = offlineMessage;
  }, [offlineMessage]);
  useEffect(() => {
    featuresRef.current = features;
  }, [features]);

  useEffect(() => {
    const transport = createChatTransport(sessionToken, apiUrl);
    transportRef.current = transport;

    const clearOfflineTimer = (): void => {
      if (offlineTimerRef.current) {
        clearTimeout(offlineTimerRef.current);
        offlineTimerRef.current = null;
      }
    };

    const unsubscribers = [
      transport.onMessage((message) => {
        if (message.sender !== 'visitor') awaitingReplyRef.current = false;
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === message.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = message;
            return next;
          }
          return [...prev, message];
        });
        setTyping(false);
      }),

      transport.onDelta(({ id, delta }) => {
        if (!featuresRef.current.streaming) return;
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], text: next[idx].text + delta, streaming: true };
            return next;
          }
          return [
            ...prev,
            {
              id,
              sender: 'assistant',
              text: delta,
              createdAt: new Date().toISOString(),
              streaming: true,
            },
          ];
        });
        setTyping(false);
      }),

      transport.onTyping(setTyping),

      transport.onStatus((s) => {
        setStatus(s);

        if (s === 'connected') {
          clearOfflineTimer();
          setChatError(null);
          transport.loadHistory().then((historyMessages) => {
            let next =
              historyMessages.length > 0
                ? historyMessages
                : [buildMessage('assistant', greetingRef.current)];

            const pending = resendRef.current;
            resendRef.current = null;
            if (pending) {
              const lastVisitor = [...historyMessages]
                .reverse()
                .find((m) => m.sender === 'visitor');
              if (lastVisitor?.text !== pending.text) {
                next = [
                  ...next,
                  {
                    id: pending.clientMessageId,
                    sender: 'visitor',
                    text: pending.text,
                    createdAt: new Date().toISOString(),
                  },
                ];
                transport.sendMessage(pending.text, pending.clientMessageId);
              }
            }
            setMessages(next);
          });
        }

        if (s === 'disconnected') {
          if (!offlineTimerRef.current) {
            offlineTimerRef.current = setTimeout(() => {
              setChatError({ code: 'offline', message: offlineMessageRef.current });
              offlineTimerRef.current = null;
            }, 30_000);
          }
        }
      }),

      transport.onError((error) => {
        if (error.code === 'rate_limited') {
          const retryAfterMs = (error.retryAfter ?? 5) * 1000;
          const retryUntil = Date.now() + retryAfterMs;
          setChatError({
            code: 'rate_limited',
            message: "You're sending messages too quickly. Please wait a moment.",
            retryUntil,
          });
          setTimeout(() => setChatError(null), retryAfterMs);
        } else if (error.code === 'quota_exceeded') {
          setChatError({ code: 'quota_exceeded', message: offlineMessageRef.current });
        } else if (error.code === 'disabled') {
          onDisabledRef.current();
        } else if (error.code === 'session_expired') {
          if (awaitingReplyRef.current) resendRef.current = lastSentRef.current;
          onSessionExpiredRef.current();
        }
      }),
    ];

    transport.connect();

    return () => {
      clearOfflineTimer();
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      transport.disconnect();
      transportRef.current = null;
    };
  }, [sessionToken, apiUrl]);

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !transportRef.current) return;
    setChatError(null);

    const clientMessageId = crypto.randomUUID();
    lastSentRef.current = { text: trimmed, clientMessageId };
    awaitingReplyRef.current = true;
    setMessages((prev) => [...prev, buildMessage('visitor', trimmed)]);
    transportRef.current.sendMessage(trimmed, clientMessageId);
  }, []);

  return { messages, typing, status, chatError, sendMessage };
}
