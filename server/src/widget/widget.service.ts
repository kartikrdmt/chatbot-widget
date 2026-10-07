import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import {
  type WidgetConfig,
  type WidgetMessage,
  type WidgetMessageSender,
  type WidgetSource,
  WidgetCopySchema,
  WidgetFeaturesSchema,
  WidgetLauncherSchema,
  WidgetThemeSchema,
} from '@myra/contracts';

import type { ChatTurn } from './answer/answer-provider.js';
import type { MessageDocument } from './schemas/message.schema.js';
import type { SiteDocument } from './schemas/site.schema.js';
import type { SessionResult } from './session.service.js';
import {
  WIDGET_DEFAULT_GREETING,
  WIDGET_DEFAULT_SUBTITLE,
  WIDGET_DEFAULT_TITLE,
} from './widget.constants.js';

export type ServerConfigResponse = WidgetConfig;

@Injectable()
export class WidgetService {
  getConfigResponse(
    site: SiteDocument,
    session?: SessionResult,
    visitorId?: string,
  ): ServerConfigResponse {
    const settings = site.settings ?? {};
    return {
      status: site.status,
      siteId: site._id.toString(),
      ...(session ? { session } : {}),
      ...(visitorId ? { visitorId } : {}),
      copy: WidgetCopySchema.parse({
        title: WIDGET_DEFAULT_TITLE,
        subtitle: WIDGET_DEFAULT_SUBTITLE,
        greeting: WIDGET_DEFAULT_GREETING,
        ...settings.copy,
      }),
      theme: WidgetThemeSchema.parse(settings.theme ?? {}),
      launcher: WidgetLauncherSchema.parse(settings.launcher ?? {}),
      features: WidgetFeaturesSchema.parse(settings.features ?? {}),
    };
  }

  buildMessage(
    sender: WidgetMessageSender,
    text: string,
    sources?: WidgetSource[],
  ): WidgetMessage {
    return {
      id: randomUUID(),
      sender,
      text,
      createdAt: new Date().toISOString(),
      ...(sources?.length ? { sources } : {}),
    };
  }

  historyToTurns(
    messages: Pick<MessageDocument, 'sender' | 'text'>[],
  ): ChatTurn[] {
    const turns: ChatTurn[] = [];
    for (const message of messages) {
      const role: ChatTurn['role'] =
        message.sender === 'visitor' ? 'user' : 'assistant';
      const last = turns.at(-1);
      if (last?.role === role) {
        last.text += `\n\n${message.text}`;
      } else if (role === 'user' || turns.length > 0) {
        turns.push({ role, text: message.text });
      }
    }
    return turns;
  }
}
