import { randomUUID } from 'node:crypto';

import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import {
  type SessionPayload,
  type WidgetChatError,
  type WidgetMessage,
  type WidgetMessageSender,
  type WidgetSource,
  WIDGET_EVENTS,
  WIDGET_LIMITS,
  WIDGET_SOCKET_NAMESPACE,
  WidgetSocketAuthSchema,
  WidgetVisitorMessageSchema,
} from '@myra/contracts';
import type { Socket } from 'socket.io';

import type { AppConfig } from '../config/configuration.js';
import { TenantContextService } from '../common/services/tenant-context.service.js';
import {
  ANSWER_PROVIDER,
  type AnswerProvider,
} from './answer/answer-provider.js';
import { ConversationService } from './conversation.service.js';
import { RateLimitService, type RateLimitScope } from './rate-limit.service.js';
import { SessionService } from './session.service.js';
import { SiteService } from './site.service.js';
import { UsageService } from './usage.service.js';
import { WIDGET_ERROR_REPLY } from './widget.constants.js';
import { WidgetService } from './widget.service.js';

const DEFAULT_MONTHLY_LIMIT = 1_000;

@WebSocketGateway({ namespace: WIDGET_SOCKET_NAMESPACE })
export class WidgetGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(WidgetGateway.name);
  private readonly connectionsByIp = new Map<string, number>();

  constructor(
    private readonly widget: WidgetService,
    private readonly sites: SiteService,
    private readonly session: SessionService,
    private readonly conversations: ConversationService,
    private readonly rateLimiter: RateLimitService,
    private readonly usage: UsageService,
    @Inject(ANSWER_PROVIDER) private readonly answers: AnswerProvider,
    private readonly tenantContext: TenantContextService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  handleConnection(client: Socket): void {
    const auth = WidgetSocketAuthSchema.safeParse(client.handshake.auth);
    if (!auth.success) {
      client.disconnect(true);
      return;
    }

    const payload = this.session.verify(auth.data.sessionToken);
    if (!payload) {
      this.reject(client, 'session_expired');
      client.disconnect(true);
      return;
    }

    const origin = client.handshake.headers.origin;
    if (!origin || origin !== payload.origin) {
      client.disconnect(true);
      return;
    }

    const ip = this.clientIp(client);
    const open = this.connectionsByIp.get(ip) ?? 0;
    if (open >= WIDGET_LIMITS.ipConnections) {
      this.reject(client, 'rate_limited', 30);
      client.disconnect(true);
      return;
    }
    this.connectionsByIp.set(ip, open + 1);

    const data = client.data as Record<string, unknown>;
    data['session'] = payload;
    data['sessionExpiresAt'] = this.session.expiresAtMs(auth.data.sessionToken);
    data['counted'] = ip;
  }

  handleDisconnect(client: Socket): void {
    const ip = (client.data as Record<string, unknown>)['counted'];
    if (typeof ip !== 'string') return;
    const open = (this.connectionsByIp.get(ip) ?? 1) - 1;
    if (open > 0) this.connectionsByIp.set(ip, open);
    else this.connectionsByIp.delete(ip);
  }

  @SubscribeMessage(WIDGET_EVENTS.history)
  async onConversationHistory(
    @ConnectedSocket() client: Socket,
  ): Promise<WidgetMessage[]> {
    const session = this.getSession(client);
    if (!session) return [];

    return this.tenantContext.run(session.tenantId, async () => {
      const conversation = await this.conversations.findOrCreate(
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
    });
  }

  @SubscribeMessage(WIDGET_EVENTS.visitorMessage)
  async onVisitorMessage(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const session = this.getSession(client);
    if (!session) return;

    const expiresAt = (client.data as Record<string, unknown>)[
      'sessionExpiresAt'
    ];
    if (typeof expiresAt === 'number' && Date.now() > expiresAt) {
      this.reject(client, 'session_expired');
      return;
    }

    const parsed = WidgetVisitorMessageSchema.safeParse(body);
    if (!parsed.success) return;

    await this.tenantContext.run(session.tenantId, () =>
      this.handleVisitorMessage(parsed.data, client, session),
    );
  }

  private async handleVisitorMessage(
    message: { text: string; clientMessageId: string },
    client: Socket,
    session: SessionPayload,
  ): Promise<void> {
    const site = await this.sites.findById(session.siteId);
    if (!site) return;

    const tenant = await this.sites.findTenant(session.tenantId);
    if (site.status === 'disabled' || tenant?.status === 'disabled') {
      this.reject(client, 'disabled');
      return;
    }

    const conversation = await this.conversations.findOrCreate(
      session.siteId,
      session.visitorId,
    );

    if (
      await this.conversations.isDuplicate(
        conversation._id,
        message.clientMessageId,
      )
    )
      return;

    const settings = site.settings ?? {};
    const scopes: RateLimitScope[] = [
      {
        key: `visitor:${session.visitorId}`,
        perMinute:
          settings.messagesPerMinute ?? WIDGET_LIMITS.visitorMessagesPerMinute,
        ...(settings.messagesPerDay !== undefined
          ? { perDay: settings.messagesPerDay }
          : {}),
      },
      {
        key: `ip:${this.clientIp(client)}`,
        perMinute: WIDGET_LIMITS.ipMessagesPerMinute,
      },
      {
        key: `site:${session.siteId}`,
        perMinute:
          settings.siteMessagesPerMinute ?? WIDGET_LIMITS.siteMessagesPerMinute,
      },
    ];
    const rate = await this.rateLimiter.checkAll(scopes);
    if (!rate.allowed) {
      this.reject(
        client,
        rate.quotaExceeded ? 'quota_exceeded' : 'rate_limited',
        rate.retryAfter,
      );
      return;
    }

    const quota = await this.usage.monthlyStatus(
      session.tenantId,
      tenant?.monthlyMessageLimit ?? DEFAULT_MONTHLY_LIMIT,
    );
    if (!quota.allowed) {
      this.reject(client, 'quota_exceeded');
      return;
    }

    await this.conversations.saveMessage(
      conversation,
      'visitor',
      message.text,
      message.clientMessageId,
    );
    await this.usage.recordMessage(session.siteId);

    const history = await this.conversations.getHistory(
      conversation._id,
      WIDGET_LIMITS.historyTurns + 1,
    );
    const turns = this.widget.historyToTurns(
      history.slice(0, history.length - 1),
    );

    client.emit(WIDGET_EVENTS.typing, true);
    const messageId = randomUUID();
    const streaming = site.settings?.features?.streaming !== false;
    let fullText = '';
    let sources: WidgetSource[] = [];

    try {
      if (streaming) {
        client.emit(WIDGET_EVENTS.message, {
          id: messageId,
          sender: 'assistant',
          text: '',
          createdAt: new Date().toISOString(),
          streaming: true,
        } satisfies WidgetMessage);
      }

      for await (const event of this.answers.answer({
        site,
        tenantId: session.tenantId,
        conversationId: conversation._id.toString(),
        question: message.text,
        history: turns,
      })) {
        if (event.type === 'sources') {
          sources = event.sources;
        } else {
          fullText += event.text;
          if (streaming) {
            client.emit(WIDGET_EVENTS.messageDelta, {
              id: messageId,
              delta: event.text,
            });
          }
        }
      }

      if (!fullText.trim())
        throw new Error('The answer provider returned no text.');

      if (streaming) {
        client.emit(WIDGET_EVENTS.messageDelta, {
          id: messageId,
          delta: '',
          done: true,
        });
      }
      const finalMessage = this.widget.buildMessage(
        'assistant',
        fullText,
        sources,
      );
      finalMessage.id = messageId;
      client.emit(WIDGET_EVENTS.message, finalMessage);

      await this.conversations.saveMessage(
        conversation,
        'assistant',
        fullText,
        undefined,
        sources,
      );
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
      const fallback = this.widget.buildMessage(
        'assistant',
        WIDGET_ERROR_REPLY,
      );
      fallback.id = messageId;
      client.emit(WIDGET_EVENTS.message, fallback);
      await this.conversations.saveMessage(
        conversation,
        'assistant',
        WIDGET_ERROR_REPLY,
      );
    } finally {
      client.emit(WIDGET_EVENTS.typing, false);
    }
  }

  private reject(
    client: Socket,
    code: WidgetChatError['code'],
    retryAfter?: number,
  ): void {
    client.emit(WIDGET_EVENTS.error, {
      code,
      ...(retryAfter !== undefined ? { retryAfter } : {}),
    } satisfies WidgetChatError);
  }

  private getSession(client: Socket): SessionPayload | undefined {
    return (client.data as Record<string, unknown>)['session'] as
      SessionPayload | undefined;
  }

  private clientIp(client: Socket): string {
    if (this.config.get('trustProxy', { infer: true })) {
      const forwarded = client.handshake.headers['x-forwarded-for'];
      const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
        ?.split(',')[0]
        ?.trim();
      if (first) return first;
    }
    return client.handshake.address;
  }
}
