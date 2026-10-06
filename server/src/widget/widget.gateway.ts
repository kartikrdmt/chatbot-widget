import { randomUUID } from 'node:crypto';

import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';

import { ConversationService } from './conversation.service.js';
import { RagService } from './rag.service.js';
import { RateLimitService } from './rate-limit.service.js';
import { SessionService } from './session.service.js';
import { SiteService } from './site.service.js';
import {
  type SessionPayload,
  type WidgetChatError,
  type WidgetMessage,
  type WidgetMessageSender,
  WIDGET_EVENTS,
  WIDGET_SOCKET_NAMESPACE,
  WidgetSocketAuthSchema,
  WidgetVisitorMessageSchema,
} from './widget.contracts.js';
import { WIDGET_ERROR_REPLY } from './widget.constants.js';
import { WidgetService } from './widget.service.js';

@WebSocketGateway({ namespace: WIDGET_SOCKET_NAMESPACE })
export class WidgetGateway implements OnGatewayConnection {
  constructor(
    private readonly widget: WidgetService,
    private readonly sites: SiteService,
    private readonly session: SessionService,
    private readonly conversations: ConversationService,
    private readonly rateLimiter: RateLimitService,
    private readonly rag: RagService,
  ) {}

  handleConnection(client: Socket): void {
    const auth = WidgetSocketAuthSchema.safeParse(client.handshake.auth);
    if (!auth.success) {
      client.disconnect(true);
      return;
    }

    const payload = this.session.verify(auth.data.sessionToken);
    if (!payload) {
      client.disconnect(true);
      return;
    }

    // Browsers always send Origin on socket connections.
    // Server-side callers without an Origin are rejected (SaaS widget only).
    const origin = client.handshake.headers.origin;
    if (!origin) {
      client.disconnect(true);
      return;
    }
    if (origin !== payload.origin) {
      client.disconnect(true);
      return;
    }

    (client.data as Record<string, unknown>)['session'] = payload;
  }

  /** Ack handler: client sends an empty body and receives the history array. */
  @SubscribeMessage(WIDGET_EVENTS.history)
  async onConversationHistory(
    @ConnectedSocket() client: Socket,
  ): Promise<WidgetMessage[]> {
    const session = this.getSession(client);
    if (!session) return [];

    const conversation = await this.conversations.findOrCreate(
      session.tenantId,
      session.siteId,
      session.visitorId,
    );
    const messages = await this.conversations.getHistory(conversation._id);
    return messages.map((m) =>
      this.widget.buildMessage(
        m.sender as WidgetMessageSender,
        m.text,
        m.sources,
      ),
    );
  }

  @SubscribeMessage(WIDGET_EVENTS.visitorMessage)
  async onVisitorMessage(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const session = this.getSession(client);
    if (!session) return;

    const parsed = WidgetVisitorMessageSchema.safeParse(body);
    if (!parsed.success) return;

    const site = await this.sites.findById(session.siteId);
    if (!site) return;

    // Rate limiting
    const perMinute = site.settings?.messagesPerMinute;
    const perDay = site.settings?.messagesPerDay;
    const rateResult = this.rateLimiter.check(
      session.visitorId,
      perMinute,
      perDay,
    );
    if (!rateResult.allowed) {
      const error: WidgetChatError = {
        code: rateResult.quotaExceeded ? 'quota_exceeded' : 'rate_limited',
        ...(rateResult.retryAfter !== undefined
          ? { retryAfter: rateResult.retryAfter }
          : {}),
      };
      client.emit(WIDGET_EVENTS.error, error);
      return;
    }

    // Get or create conversation
    const conversation = await this.conversations.findOrCreate(
      session.tenantId,
      session.siteId,
      session.visitorId,
    );

    // Dedup: skip if client already sent this message ID
    if (
      await this.conversations.isDuplicate(
        conversation._id,
        parsed.data.clientMessageId,
      )
    ) {
      return;
    }

    // Persist visitor message
    await this.conversations.saveMessage(
      conversation._id,
      'visitor',
      parsed.data.text,
      parsed.data.clientMessageId,
    );

    // Build Gemini turns from stored history (excluding the message we just saved)
    const history = await this.conversations.getHistory(conversation._id, 20);
    const turns = this.widget.historyToTurns(
      history.slice(0, history.length - 1),
    );

    // RAG context (no-op placeholder)
    const ragContext = await this.rag.retrieve(
      parsed.data.text,
      session.siteId,
    );

    client.emit(WIDGET_EVENTS.typing, true);

    const messageId = randomUUID();
    let fullText = '';

    try {
      const features = site.settings?.features as
        | { streaming?: boolean }
        | undefined;
      const useStreaming = features?.streaming !== false;

      if (useStreaming) {
        // Emit a placeholder message so the client renders the streaming bubble immediately
        client.emit(WIDGET_EVENTS.message, {
          id: messageId,
          sender: 'assistant',
          text: '',
          createdAt: new Date().toISOString(),
          streaming: true,
        } satisfies WidgetMessage);

        for await (const chunk of this.widget.replyStream(
          parsed.data.text,
          turns,
          site,
        )) {
          fullText += chunk;
          client.emit(WIDGET_EVENTS.messageDelta, { id: messageId, delta: chunk });
        }

        // Signal end-of-stream then emit the authoritative final message with sources
        client.emit(WIDGET_EVENTS.messageDelta, {
          id: messageId,
          delta: '',
          done: true,
        });

        const finalMsg = this.widget.buildMessage(
          'assistant',
          fullText,
          ragContext.sources,
        );
        finalMsg.id = messageId;
        client.emit(WIDGET_EVENTS.message, finalMsg);
      } else {
        const reply = await this.widget.reply(parsed.data.text, turns, site);
        if (ragContext.sources.length) {
          reply.sources = ragContext.sources;
        }
        client.emit(WIDGET_EVENTS.message, reply);
        fullText = reply.text;
      }

      await this.conversations.saveMessage(
        conversation._id,
        'assistant',
        fullText || WIDGET_ERROR_REPLY,
        undefined,
        ragContext.sources.length ? ragContext.sources : undefined,
      );
    } catch (error) {
      const fallback = this.widget.buildMessage('assistant', WIDGET_ERROR_REPLY);
      client.emit(WIDGET_EVENTS.message, fallback);
      // Also persist the error reply so history is consistent
      await this.conversations.saveMessage(
        conversation._id,
        'assistant',
        WIDGET_ERROR_REPLY,
      );
    } finally {
      client.emit(WIDGET_EVENTS.typing, false);
    }
  }

  private getSession(client: Socket): SessionPayload | undefined {
    return (client.data as Record<string, unknown>)[
      'session'
    ] as SessionPayload | undefined;
  }
}
