import { Injectable, Logger } from '@nestjs/common';
import { WIDGET_LIMITS } from '@myra/contracts';

import { GEMINI_DEFAULT_MODEL, GEMINI_TIMEOUT_MS } from './widget.constants.js';

export interface GeminiTurn {
  role: 'user' | 'model';
  text: string;
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
  }[];
}

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

const RETRY_STATUSES = new Set([429, 500, 503]);
const RETRY_DELAYS_MS = [800, 2_000];

async function fetchWithRetry(
  url: string,
  init: () => RequestInit,
): Promise<Response> {
  for (const delay of RETRY_DELAYS_MS) {
    const response = await fetch(url, init());
    if (!RETRY_STATUSES.has(response.status)) return response;
    await response.body?.cancel();
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return fetch(url, init());
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  async generate(
    systemPrompt: string,
    turns: GeminiTurn[],
    model?: string,
  ): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set.');

    const resolvedModel =
      model ?? process.env.GEMINI_MODEL ?? GEMINI_DEFAULT_MODEL;
    const response = await fetchWithRetry(
      `${ENDPOINT}/${resolvedModel}:generateContent`,
      () => ({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { maxOutputTokens: WIDGET_LIMITS.maxOutputTokens },
          contents: turns.map((turn) => ({
            role: turn.role,
            parts: [{ text: turn.text }],
          })),
        }),
      }),
    );

    if (!response.ok) {
      this.logger.error(
        `Gemini returned ${response.status}: ${await response.text()}`,
      );
      throw new Error(`Gemini request failed with ${response.status}.`);
    }

    const body = (await response.json()) as GeminiResponse;
    const text = (body.candidates?.[0]?.content?.parts ?? [])
      .filter((part) => !part.thought)
      .map((part) => part.text ?? '')
      .join('')
      .trim();

    if (!text) throw new Error('Gemini returned an empty reply.');
    return text;
  }

  async *generateStream(
    systemPrompt: string,
    turns: GeminiTurn[],
    model?: string,
  ): AsyncGenerator<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set.');

    const resolvedModel =
      model ?? process.env.GEMINI_MODEL ?? GEMINI_DEFAULT_MODEL;
    const response = await fetchWithRetry(
      `${ENDPOINT}/${resolvedModel}:streamGenerateContent?alt=sse`,
      () => ({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { maxOutputTokens: WIDGET_LIMITS.maxOutputTokens },
          contents: turns.map((turn) => ({
            role: turn.role,
            parts: [{ text: turn.text }],
          })),
        }),
      }),
    );

    if (!response.ok || !response.body) {
      this.logger.error(`Gemini streaming returned ${response.status}`);
      throw new Error(`Gemini stream request failed with ${response.status}.`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') return;
        try {
          const chunk = JSON.parse(data) as GeminiResponse;
          const text = (chunk.candidates?.[0]?.content?.parts ?? [])
            .filter((p) => !p.thought)
            .map((p) => p.text ?? '')
            .join('');
          if (text) yield text;
        } catch {}
      }
    }
  }
}
