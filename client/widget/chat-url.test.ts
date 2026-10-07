import { describe, expect, it } from 'vitest';

import { resolveChatUrl } from './chat-url';

const url = (script: string) => resolveChatUrl(script, '1.0.0', 'chat.ABC.js');

describe('resolveChatUrl', () => {
  it('finds the chat file from each of the three ways the loader is published', () => {
    expect(url('https://cdn.example.com/widget.js')).toBe(
      'https://cdn.example.com/v1.0.0/chat.ABC.js',
    );
    expect(url('https://cdn.example.com/v1/widget.js')).toBe(
      'https://cdn.example.com/v1.0.0/chat.ABC.js',
    );
    expect(url('https://cdn.example.com/v1.0.0/widget.js')).toBe(
      'https://cdn.example.com/v1.0.0/chat.ABC.js',
    );
  });

  it('works when everything is hosted under a sub-path', () => {
    expect(url('https://cdn.example.com/chatbot/widget.js')).toBe(
      'https://cdn.example.com/chatbot/v1.0.0/chat.ABC.js',
    );
    expect(url('https://cdn.example.com/a/b/v1/widget.js')).toBe(
      'https://cdn.example.com/a/b/v1.0.0/chat.ABC.js',
    );
    expect(url('https://cdn.example.com/chatbot/v1.0.0/widget.js')).toBe(
      'https://cdn.example.com/chatbot/v1.0.0/chat.ABC.js',
    );
  });

  it('ignores a query string or fragment on the loader address', () => {
    expect(url('https://cdn.example.com/v1/widget.js?x=1#y')).toBe(
      'https://cdn.example.com/v1.0.0/chat.ABC.js',
    );
  });

  it('keeps the loader host and port, never the page', () => {
    expect(url('http://localhost:3000/widget.js')).toBe('http://localhost:3000/v1.0.0/chat.ABC.js');
  });

  it('returns nothing when the loader address is unknown or not http(s)', () => {
    expect(url('')).toBeNull();
    expect(url('not a url')).toBeNull();
    expect(url('/widget.js')).toBeNull();
    expect(url('javascript:alert(1)')).toBeNull();
    expect(url('data:text/javascript,1')).toBeNull();
  });
});
