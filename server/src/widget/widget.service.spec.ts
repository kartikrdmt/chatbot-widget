import type { SiteDocument } from './schemas/site.schema.js';
import { GeminiService } from './gemini.service.js';
import { WidgetService } from './widget.service.js';
import {
  WIDGET_DEFAULT_SYSTEM_PROMPT,
  WIDGET_ERROR_REPLY,
} from './widget.constants.js';

const DEMO_SITE = { settings: {} } as unknown as SiteDocument;

describe('WidgetService.reply', () => {
  it('uses the default system prompt and passes turns to Gemini', async () => {
    const generate = vi.fn().mockResolvedValue('Hello!');
    const service = new WidgetService({
      generate,
    } as unknown as GeminiService);

    const reply = await service.reply(
      'and pricing?',
      [
        { role: 'user', text: 'What do you do?' },
        { role: 'model', text: 'We build software.' },
      ],
      DEMO_SITE,
    );

    expect(reply.text).toBe('Hello!');
    expect(generate).toHaveBeenCalledWith(
      WIDGET_DEFAULT_SYSTEM_PROMPT,
      [
        { role: 'user', text: 'What do you do?' },
        { role: 'model', text: 'We build software.' },
        { role: 'user', text: 'and pricing?' },
      ],
      undefined,
    );
  });

  it('uses a per-site systemPrompt when configured', async () => {
    const generate = vi.fn().mockResolvedValue('Hi!');
    const service = new WidgetService({
      generate,
    } as unknown as GeminiService);
    const site = {
      settings: { systemPrompt: 'You are Acme bot.' },
    } as unknown as SiteDocument;

    await service.reply('hi', [], site);

    expect(generate).toHaveBeenCalledWith(
      'You are Acme bot.',
      [{ role: 'user', text: 'hi' }],
      undefined,
    );
  });

  it('uses a per-site llmModel when configured', async () => {
    const generate = vi.fn().mockResolvedValue('Hi!');
    const service = new WidgetService({
      generate,
    } as unknown as GeminiService);
    const site = {
      settings: { llmModel: 'gemini-2.0-pro' },
    } as unknown as SiteDocument;

    await service.reply('hi', [], site);

    expect(generate).toHaveBeenCalledWith(
      WIDGET_DEFAULT_SYSTEM_PROMPT,
      [{ role: 'user', text: 'hi' }],
      'gemini-2.0-pro',
    );
  });

  it('falls back to an apology when Gemini fails', async () => {
    const generate = vi.fn().mockRejectedValue(new Error('boom'));
    const service = new WidgetService({
      generate,
    } as unknown as GeminiService);

    expect((await service.reply('hi', [], DEMO_SITE)).text).toBe(
      WIDGET_ERROR_REPLY,
    );
  });
});

describe('WidgetService.historyToTurns', () => {
  const service = new WidgetService({} as GeminiService);

  it('converts messages to alternating turns', () => {
    const messages = [
      { sender: 'visitor', text: 'Hello' },
      { sender: 'assistant', text: 'Hi there' },
      { sender: 'visitor', text: 'Pricing?' },
    ] as any;

    expect(service.historyToTurns(messages)).toEqual([
      { role: 'user', text: 'Hello' },
      { role: 'model', text: 'Hi there' },
      { role: 'user', text: 'Pricing?' },
    ]);
  });

  it('merges consecutive turns from the same role', () => {
    const messages = [
      { sender: 'visitor', text: 'Part 1' },
      { sender: 'visitor', text: 'Part 2' },
      { sender: 'assistant', text: 'Reply' },
    ] as any;

    expect(service.historyToTurns(messages)).toEqual([
      { role: 'user', text: 'Part 1\n\nPart 2' },
      { role: 'model', text: 'Reply' },
    ]);
  });
});
