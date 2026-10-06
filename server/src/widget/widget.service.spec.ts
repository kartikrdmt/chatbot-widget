import { GeminiService } from './gemini.service.js';
import { WidgetService } from './widget.service.js';
import {
  WIDGET_ERROR_REPLY,
  WIDGET_SYSTEM_PROMPT,
} from './widget.constants.js';

describe('WidgetService.reply', () => {
  it('sends the Myra system prompt and drops the leading greeting', async () => {
    const generate = vi.fn().mockResolvedValue('Hello!');
    const service = new WidgetService({ generate } as unknown as GeminiService);

    const reply = await service.reply('and pricing?', [
      { sender: 'assistant', text: 'Hi there!' },
      { sender: 'visitor', text: 'What do you do?' },
      { sender: 'assistant', text: 'We build software.' },
    ]);

    expect(reply.text).toBe('Hello!');
    expect(generate).toHaveBeenCalledWith(WIDGET_SYSTEM_PROMPT, [
      { role: 'user', text: 'What do you do?' },
      { role: 'model', text: 'We build software.' },
      { role: 'user', text: 'and pricing?' },
    ]);
  });

  it('falls back to an apology when Gemini fails', async () => {
    const generate = vi.fn().mockRejectedValue(new Error('boom'));
    const service = new WidgetService({ generate } as unknown as GeminiService);

    expect((await service.reply('hi', [])).text).toBe(WIDGET_ERROR_REPLY);
  });
});
