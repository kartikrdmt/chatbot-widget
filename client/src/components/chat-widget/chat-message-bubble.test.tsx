import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ChatMessageBubble } from './chat-message-bubble';

const render = (text: string): string =>
  renderToStaticMarkup(
    <ChatMessageBubble
      message={{ id: '1', sender: 'assistant', text, createdAt: new Date().toISOString() }}
      showAvatar={false}
      showTime={false}
    />,
  );

/** Real elements or attributes that would run script or load content. Escaped text is fine. */
const hasLiveHazard = (html: string): boolean =>
  /<(script|img|iframe|svg|object|embed)\b|<[^>]*\son\w+=|href="(javascript|vbscript|data):/i.test(
    html,
  );

describe('assistant messages are rendered safely', () => {
  it.each([
    ['javascript: link', '[click](javascript:alert(1))'],
    ['mixed-case javascript: link', '[click](JaVaScRiPt:alert(1))'],
    ['data: link', '[click](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)'],
    ['vbscript: link', '[click](vbscript:msgbox(1))'],
    ['raw <script>', 'hi <script>alert(1)</script>'],
    ['raw <img onerror>', '<img src=x onerror=alert(1)>'],
    ['raw <a href=javascript:>', '<a href="javascript:alert(1)">x</a>'],
    ['raw <iframe>', '<iframe src="https://evil.example"></iframe>'],
  ])('%s', (_name, text) => {
    expect(hasLiveHazard(render(text))).toBe(false);
  });

  it('keeps the text of a blocked link, without the link', () => {
    const html = render('[click me](javascript:alert(1))');
    expect(html).toContain('click me');
    expect(html).not.toContain('<a ');
  });

  it.each([
    ['https', '[site](https://example.com)', 'https://example.com'],
    ['http', '[site](http://example.com)', 'http://example.com'],
    ['mailto', '[mail](mailto:a@b.com)', 'mailto:a@b.com'],
    ['tel', '[call](tel:+123456)', 'tel:+123456'],
  ])('allows %s links, opened in a new tab', (_name, text, href) => {
    const html = render(text);
    expect(html).toContain(`href="${href}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});
