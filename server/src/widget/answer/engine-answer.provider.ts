import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ChatResponseSchema,
  type ChatRequest,
  type WidgetSource,
} from '@myra/contracts';

import type { AppConfig } from '../../config/configuration.js';
import {
  type AnswerEvent,
  type AnswerProvider,
  type AnswerRequest,
} from './answer-provider.js';

const CHUNK_SIZE = 48;

/**
 * Asks the Python engine, which owns retrieval over the scraped site, using the engine's own
 * `ChatRequest` / `ChatResponse` contract (`POST {ENGINE_URL}/chat`). The citations it returns
 * become the source links under the answer.
 *
 * The engine answers in one piece, so the text is handed on in small chunks to keep the widget's
 * streaming behaviour the same for every provider.
 */
@Injectable()
export class EngineAnswerProvider implements AnswerProvider {
  private readonly logger = new Logger(EngineAnswerProvider.name);

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  async *answer(request: AnswerRequest): AsyncGenerator<AnswerEvent> {
    const { url, timeoutMs } = this.config.get('engine', { infer: true });

    const body: ChatRequest = {
      tenantId: request.tenantId,
      message: request.question,
      conversationId: request.conversationId,
      history: request.history.map((turn) => ({
        role: turn.role,
        content: turn.text,
      })),
      topK: 8,
    };

    const response = await fetch(`${url}/chat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      this.logger.error(`Engine /chat returned ${response.status}`);
      throw new Error(`Engine /chat failed with ${response.status}.`);
    }

    // Parsed through the shared schema, so a drift between the services fails here, loudly.
    const parsed = ChatResponseSchema.parse(await response.json());

    for (let i = 0; i < parsed.answer.length; i += CHUNK_SIZE) {
      yield { type: 'delta', text: parsed.answer.slice(i, i + CHUNK_SIZE) };
    }

    const sources: WidgetSource[] = parsed.citations.map((citation) => ({
      title: citation.title?.trim() || hostOf(citation.url),
      url: citation.url,
    }));
    if (sources.length) yield { type: 'sources', sources };
  }
}

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};
