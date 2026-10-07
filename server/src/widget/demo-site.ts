import type { SiteSettings } from './schemas/site.schema.js';

/**
 * The look and prompt of the development demo site (`st_demo`). This is the same kind of record an
 * admin saves for a real customer: nothing about Myra Technolabs is hard-coded anywhere else.
 */
export const DEMO_SITE_SETTINGS: SiteSettings = {
  copy: {
    title: 'Myra Technolabs',
    subtitle: 'AI assistant · replies instantly',
    greeting: "Hi! I'm the Myra Technolabs assistant. Ask me anything.",
    placeholder: 'Type your question...',
    avatarText: 'M',
  },
  theme: {
    accent: '#162E56',
    accentForeground: '#ffffff',
    surface: '#ffffff',
    raised: '#f3f6fb',
    foreground: '#162E56',
    muted: '#7d8aa8',
    border: '#dde3ee',
    radius: 'rounded',
  },
  launcher: { position: 'bottom-right' },
  systemPrompt: [
    'You are the chatbot AI assistant for Myra Technolabs.',
    'Answer visitors in a friendly, professional and concise way.',
    'Help with questions about the company, its services, careers and how to get in touch.',
  ].join(' '),
};
