'use client';

import {
  WIDGET_MAX_HISTORY,
  type WidgetMessage,
  WidgetMessageSchema,
} from '@/lib/contracts/widget';
import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';

import { type ChatTransport, type ConnectionStatus, createChatTransport } from '@/lib/chat';

const MAX_STORED_MESSAGES = 100;

const storageKey = (widgetKey: string): string => `myra.chat.${widgetKey}.messages`;

const buildMessage = (sender: WidgetMessage['sender'], text: string): WidgetMessage => ({
  id: crypto.randomUUID(),
  sender,
  text,
  createdAt: new Date().toISOString(),
});

function loadMessages(widgetKey: string): WidgetMessage[] {
  try {
    const raw = localStorage.getItem(storageKey(widgetKey));
    const parsed = z.array(WidgetMessageSchema).safeParse(raw ? JSON.parse(raw) : []);
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function saveMessages(widgetKey: string, messages: WidgetMessage[]): void {
  try {
    localStorage.setItem(
      storageKey(widgetKey),
      JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)),
    );
  } catch {
    // Storage can be blocked or full; the chat still works for this page view.
  }
}

export interface UseChatResult {
  messages: WidgetMessage[];
  typing: boolean;
  status: ConnectionStatus;
  sendMessage: (text: string) => void;
}

/**
 * The conversation is kept in `localStorage` per widget key, so it survives a
 * page refresh. The greeting is only added to a conversation that is empty.
 */
export function useChat(widgetKey: string, apiUrl: string, greeting: string): UseChatResult {
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const transportRef = useRef<ChatTransport | null>(null);
  const messagesRef = useRef<WidgetMessage[]>([]);
  const greetingRef = useRef(greeting);

  useEffect(() => {
    greetingRef.current = greeting;
  }, [greeting]);

  useEffect(() => {
    messagesRef.current = messages;
    // Empty means the stored conversation has not been restored yet.
    if (messages.length > 0) saveMessages(widgetKey, messages);
  }, [messages, widgetKey]);

  useEffect(() => {
    const stored = loadMessages(widgetKey);
    setMessages(stored.length > 0 ? stored : [buildMessage('assistant', greetingRef.current)]);
  }, [widgetKey]);

  useEffect(() => {
    const transport = createChatTransport(widgetKey, apiUrl);
    transportRef.current = transport;

    const unsubscribers = [
      transport.onMessage((message) => setMessages((previous) => [...previous, message])),
      transport.onTyping(setTyping),
      transport.onStatus(setStatus),
    ];

    transport.connect();

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      transport.disconnect();
      transportRef.current = null;
    };
  }, [widgetKey, apiUrl]);

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !transportRef.current) return;

    const history = messagesRef.current
      .slice(-WIDGET_MAX_HISTORY)
      .map(({ sender, text: content }) => ({ sender, text: content }));

    setMessages((previous) => [...previous, buildMessage('visitor', trimmed)]);
    transportRef.current.sendMessage(trimmed, history);
  }, []);

  return { messages, typing, status, sendMessage };
}
