import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import {
  DEFAULT_WIDGET_CONFIG,
  type WidgetConfig,
  type WidgetEmbedPolicy,
  type WidgetHistoryItem,
  type WidgetMessage,
  type WidgetMessageSender,
} from './widget.contracts.js';

import { type GeminiTurn, GeminiService } from './gemini.service.js';
import {
  WIDGET_ERROR_REPLY,
  WIDGET_GREETING,
  WIDGET_SUBTITLE,
  WIDGET_SYSTEM_PROMPT,
} from './widget.constants.js';
import type { WidgetSite } from './widget-site.schema.js';

/** Widget behaviour: config for the embed script and Gemini-backed replies. */
@Injectable()
export class WidgetService {
  private readonly logger = new Logger(WidgetService.name);

  constructor(private readonly gemini: GeminiService) {}

  getConfig(site: WidgetSite): WidgetConfig {
    return {
      ...DEFAULT_WIDGET_CONFIG,
      key: site.key,
      subtitle: WIDGET_SUBTITLE,
      greeting: WIDGET_GREETING,
      position: site.position ?? DEFAULT_WIDGET_CONFIG.position,
    };
  }

  getEmbedPolicy(site: WidgetSite): WidgetEmbedPolicy {
    return { allowedOrigins: site.allowedOrigins };
  }

  async reply(
    text: string,
    history: WidgetHistoryItem[],
  ): Promise<WidgetMessage> {
    try {
      const reply = await this.gemini.generate(
        WIDGET_SYSTEM_PROMPT,
        this.toTurns(text, history),
      );
      return this.buildMessage('assistant', reply);
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : error);
      return this.buildMessage('assistant', WIDGET_ERROR_REPLY);
    }
  }

  /**
   * Gemini wants alternating turns that start with the visitor, so the
   * assistant's opening greeting is dropped and neighbouring turns by the same
   * side are merged.
   */
  private toTurns(text: string, history: WidgetHistoryItem[]): GeminiTurn[] {
    const turns: GeminiTurn[] = [];
    const push = (role: GeminiTurn['role'], content: string): void => {
      const last = turns.at(-1);
      if (last?.role === role) last.text += `\n\n${content}`;
      else if (role === 'user' || last) turns.push({ role, text: content });
    };

    for (const item of history) {
      if (item.text.trim()) {
        push(item.sender === 'visitor' ? 'user' : 'model', item.text);
      }
    }
    push('user', text);
    return turns;
  }

  private buildMessage(
    sender: WidgetMessageSender,
    text: string,
  ): WidgetMessage {
    return {
      id: randomUUID(),
      sender,
      text,
      createdAt: new Date().toISOString(),
    };
  }
}
