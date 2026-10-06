import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import type { RagSource } from './rag.service.js';
import type { SiteDocument } from './schemas/site.schema.js';
import type { MessageDocument } from './schemas/message.schema.js';
import type { SessionResult } from './session.service.js';
import {
  type WidgetCopy,
  type WidgetFeatures,
  type WidgetLauncher,
  type WidgetMessage,
  type WidgetMessageSender,
  type WidgetTheme,
  WidgetCopySchema,
  WidgetFeaturesSchema,
  WidgetLauncherSchema,
  WidgetThemeSchema,
} from './widget.contracts.js';
import {
  WIDGET_DEFAULT_GREETING,
  WIDGET_DEFAULT_SUBTITLE,
  WIDGET_DEFAULT_SYSTEM_PROMPT,
  WIDGET_DEFAULT_TITLE,
  WIDGET_ERROR_REPLY,
} from './widget.constants.js';
import { type GeminiTurn, GeminiService } from './gemini.service.js';

export interface ServerConfigResponse {
  status: 'active' | 'disabled';
  siteId: string;
  session: SessionResult;
  visitorId: string;
  copy: WidgetCopy;
  theme: WidgetTheme;
  launcher: WidgetLauncher;
  features: WidgetFeatures;
}

@Injectable()
export class WidgetService {
  private readonly logger = new Logger(WidgetService.name);

  constructor(private readonly gemini: GeminiService) {}

  /** Build the HTTP config response from a site's DB settings. */
  getConfigResponse(
    site: SiteDocument,
    session: SessionResult,
    visitorId: string,
  ): ServerConfigResponse {
    const s = site.settings ?? {};
    return {
      status: site.status,
      siteId: site._id.toString(),
      session,
      visitorId,
      copy: WidgetCopySchema.parse({
        title: WIDGET_DEFAULT_TITLE,
        subtitle: WIDGET_DEFAULT_SUBTITLE,
        greeting: WIDGET_DEFAULT_GREETING,
        ...((s.copy as object | undefined) ?? {}),
      }),
      theme: WidgetThemeSchema.parse((s.theme as object | undefined) ?? {}),
      launcher: WidgetLauncherSchema.parse(
        (s.launcher as object | undefined) ?? {},
      ),
      features: WidgetFeaturesSchema.parse(
        (s.features as object | undefined) ?? {},
      ),
    };
  }

  /** Non-streaming reply — used when streaming is disabled for a site. */
  async reply(
    text: string,
    turns: GeminiTurn[],
    site: SiteDocument,
  ): Promise<WidgetMessage> {
    try {
      const systemPrompt =
        site.settings?.systemPrompt ?? WIDGET_DEFAULT_SYSTEM_PROMPT;
      const model = site.settings?.llmModel ?? undefined;
      const replyText = await this.gemini.generate(
        systemPrompt,
        [...turns, { role: 'user', text }],
        model,
      );
      return this.buildMessage('assistant', replyText);
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
      return this.buildMessage('assistant', WIDGET_ERROR_REPLY);
    }
  }

  /** Streaming reply — yields text deltas as they arrive from Gemini. */
  async *replyStream(
    text: string,
    turns: GeminiTurn[],
    site: SiteDocument,
  ): AsyncGenerator<string> {
    const systemPrompt =
      site.settings?.systemPrompt ?? WIDGET_DEFAULT_SYSTEM_PROMPT;
    const model = site.settings?.llmModel ?? undefined;
    yield* this.gemini.generateStream(
      systemPrompt,
      [...turns, { role: 'user', text }],
      model,
    );
  }

  buildMessage(
    sender: WidgetMessageSender,
    text: string,
    sources?: RagSource[],
  ): WidgetMessage {
    return {
      id: randomUUID(),
      sender,
      text,
      createdAt: new Date().toISOString(),
      ...(sources?.length ? { sources } : {}),
    };
  }

  /**
   * Convert DB messages to Gemini turn format.
   * Neighbouring turns from the same role are merged (Gemini requires alternating roles).
   * The opening assistant greeting is dropped so turns always start with the visitor.
   */
  historyToTurns(messages: MessageDocument[]): GeminiTurn[] {
    const turns: GeminiTurn[] = [];
    for (const msg of messages) {
      const role: GeminiTurn['role'] =
        msg.sender === 'visitor' ? 'user' : 'model';
      const last = turns.at(-1);
      if (last?.role === role) {
        last.text += `\n\n${msg.text}`;
      } else if (role === 'user' || turns.length > 0) {
        turns.push({ role, text: msg.text });
      }
    }
    return turns;
  }
}
