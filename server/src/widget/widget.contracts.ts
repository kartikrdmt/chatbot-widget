import { z } from 'zod';
const IsoDateTimeSchema = z.string().datetime({ offset: true });

const DEFAULT_GREETING = 'Hi there! How can I help you today?';

export const WIDGET_SOCKET_NAMESPACE = '/widget';

export const WIDGET_EVENTS = {
  visitorMessage: 'visitor:chat:message',
  message: 'chat:message',
  typing: 'chat:typing',
} as const;

export const WidgetPositionSchema = z.enum([
  'bottom-right',
  'bottom-left',
  'top-right',
  'top-left',
]);

export const WidgetConfigSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  greeting: z.string().min(1).default(DEFAULT_GREETING),
  position: WidgetPositionSchema.default('bottom-right'),
});

export const WidgetEmbedPolicySchema = z.object({
  allowedOrigins: z.array(z.string().min(1)),
});

export const WidgetMessageSenderSchema = z.enum([
  'visitor',
  'assistant',
  'agent',
]);

export const WidgetMessageSchema = z.object({
  id: z.string().min(1),
  sender: WidgetMessageSenderSchema,
  text: z.string().min(1),
  createdAt: IsoDateTimeSchema,
});

export const WidgetHistoryItemSchema = z.object({
  sender: WidgetMessageSenderSchema,
  text: z.string().max(8_000),
});

export const WIDGET_MAX_HISTORY = 20;

export const WidgetVisitorMessageSchema = z.object({
  text: z.string().trim().min(1).max(8_000),
  history: z.array(WidgetHistoryItemSchema).max(WIDGET_MAX_HISTORY).default([]),
});

export const WidgetSocketAuthSchema = z.object({
  key: z.string().min(1),
  visitorId: z.string().min(1),
});

export const DEFAULT_WIDGET_CONFIG: Omit<WidgetConfig, 'key'> = {
  title: 'How can we help?',
  greeting: DEFAULT_GREETING,
  position: 'bottom-right',
};

export type WidgetPosition = z.infer<typeof WidgetPositionSchema>;
export type WidgetConfig = z.infer<typeof WidgetConfigSchema>;
export type WidgetEmbedPolicy = z.infer<typeof WidgetEmbedPolicySchema>;
export type WidgetMessageSender = z.infer<typeof WidgetMessageSenderSchema>;
export type WidgetMessage = z.infer<typeof WidgetMessageSchema>;
export type WidgetHistoryItem = z.infer<typeof WidgetHistoryItemSchema>;
export type WidgetVisitorMessage = z.infer<typeof WidgetVisitorMessageSchema>;
export type WidgetSocketAuth = z.infer<typeof WidgetSocketAuthSchema>;
