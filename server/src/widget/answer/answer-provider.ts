import type { WidgetSource } from '@myra/contracts';

import type { SiteDocument } from '../schemas/site.schema.js';

/** One earlier message, in a form every provider understands. */
export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface AnswerRequest {
  site: SiteDocument;
  tenantId: string;
  /** The conversation this question belongs to. */
  conversationId: string;
  question: string;
  /** Earlier messages, oldest first, not including the question. */
  history: ChatTurn[];
}

/** What a provider hands back, in order: text as it is produced, and where it came from. */
export type AnswerEvent =
  | { type: 'delta'; text: string }
  | { type: 'sources'; sources: WidgetSource[] };

/**
 * Where an answer comes from. The gateway only knows this interface, so the widget does not care
 * whether the answer is a direct LLM call or the Python engine's retrieval over the scraped site.
 */
export interface AnswerProvider {
  answer(request: AnswerRequest): AsyncGenerator<AnswerEvent>;
}

/** Nest injection token for the active provider. */
export const ANSWER_PROVIDER = Symbol('ANSWER_PROVIDER');
