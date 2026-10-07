import { Injectable } from '@nestjs/common';

import { GeminiService } from '../gemini.service.js';
import { RagService } from '../rag.service.js';
import {
  type AnswerEvent,
  type AnswerProvider,
  type AnswerRequest,
} from './answer-provider.js';
import { buildSystemPrompt } from './prompt.js';

/**
 * Asks Gemini directly. Retrieval (`RagService`) supplies reference text and source links; today it
 * finds nothing, so the answer comes from the prompt alone.
 */
@Injectable()
export class GeminiAnswerProvider implements AnswerProvider {
  constructor(
    private readonly gemini: GeminiService,
    private readonly rag: RagService,
  ) {}

  async *answer(request: AnswerRequest): AsyncGenerator<AnswerEvent> {
    const context = await this.rag.retrieve(
      request.question,
      request.site._id.toString(),
    );
    const systemPrompt = buildSystemPrompt(
      request.site.settings?.systemPrompt,
      context.text,
    );

    yield* this.stream(request, systemPrompt);
    if (context.sources.length)
      yield { type: 'sources', sources: context.sources };
  }

  private async *stream(
    request: AnswerRequest,
    systemPrompt: string,
  ): AsyncGenerator<AnswerEvent> {
    const turns = [
      ...request.history.map((turn) => ({
        role: turn.role === 'user' ? ('user' as const) : ('model' as const),
        text: turn.text,
      })),
      { role: 'user' as const, text: request.question },
    ];
    for await (const text of this.gemini.generateStream(
      systemPrompt,
      turns,
      request.site.settings?.llmModel,
    )) {
      yield { type: 'delta', text };
    }
  }
}
