import type { WidgetSource } from '@myra/contracts';

import type { SiteDocument } from '../schemas/site.schema.js';

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface AnswerRequest {
  site: SiteDocument;
  tenantId: string;
  conversationId: string;
  question: string;
  history: ChatTurn[];
}

export type AnswerEvent =
  | { type: 'delta'; text: string }
  | { type: 'sources'; sources: WidgetSource[] };

export interface AnswerProvider {
  answer(request: AnswerRequest): AsyncGenerator<AnswerEvent>;
}

export const ANSWER_PROVIDER = Symbol('ANSWER_PROVIDER');
