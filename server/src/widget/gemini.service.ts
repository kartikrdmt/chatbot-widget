import { Injectable, Logger } from '@nestjs/common';

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

/** Thin client for Gemini's `generateContent` REST endpoint. */
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  async generate(systemPrompt: string, turns: GeminiTurn[]): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set.');

    const model = process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL;
    const response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: turns.map((turn) => ({
          role: turn.role,
          parts: [{ text: turn.text }],
        })),
      }),
    });

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
}
