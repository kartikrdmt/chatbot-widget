export const WIDGET_DEFAULT_GREETING = 'Hi there! How can I help you today?';
export const WIDGET_DEFAULT_TITLE = 'Chat with us';
export const WIDGET_DEFAULT_SUBTITLE = 'We usually reply in a few minutes';
export const WIDGET_DEFAULT_SYSTEM_PROMPT = [
  'You are a helpful AI assistant for a website.',
  'Answer visitor questions in a friendly, professional, and concise way.',
  'If you do not know something specific, say so honestly and suggest contacting the team.',
  'Keep replies short, use simple Markdown (lists, bold) when it helps,',
  'and reply in the language the visitor writes in.',
].join(' ');

export const WIDGET_ERROR_REPLY =
  'Sorry, I could not answer that right now. Please try again in a moment.';

export const GEMINI_DEFAULT_MODEL = 'gemini-2.0-flash-lite';
export const GEMINI_TIMEOUT_MS = 30_000;

export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_DEFAULT_MAX = 10;
