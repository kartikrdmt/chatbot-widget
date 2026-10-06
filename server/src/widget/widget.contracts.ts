import { z } from 'zod';

const IsoDateTimeSchema = z.string().datetime({ offset: true });

export const WIDGET_SOCKET_NAMESPACE = '/widget';

export const WIDGET_EVENTS = {
  visitorMessage: 'visitor:chat:message',
  message: 'chat:message',
  messageDelta: 'chat:message:delta',
  typing: 'chat:typing',
  error: 'chat:error',
  history: 'conversation:history',
} as const;

export const WIDGET_ERROR_CODES = [
  'rate_limited',
  'quota_exceeded',
  'disabled',
  'session_expired',
] as const;

export const WidgetPositionSchema = z.enum([
  'bottom-right',
  'bottom-left',
  'bottom-center',
  'top-right',
  'top-left',
  'top-center',
  'left-center',
  'right-center',
]);

export const WidgetThemeSchema = z.object({
  accentColor: z.string().optional(),
  accentTextColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  chatBackgroundColor: z.string().optional(),
  textColor: z.string().optional(),
  mutedColor: z.string().optional(),
  borderColor: z.string().optional(),
  radius: z.enum(['square', 'rounded', 'pill']).optional(),
  font: z.string().optional(),
});

export const WidgetCopySchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  greeting: z.string().optional(),
  placeholder: z.string().optional(),
  offlineMessage: z.string().optional(),
  avatarText: z.string().max(2).optional(),
});

export const WidgetLauncherSchema = z.object({
  position: WidgetPositionSchema.optional(),
  offset: z.number().optional(),
  width: z.string().optional(),
  height: z.string().optional(),
});

export const WidgetFeaturesSchema = z.object({
  showSources: z.boolean().optional(),
  streaming: z.boolean().optional(),
  rateLimit: z.boolean().optional(),
});

export const SessionPayloadSchema = z.object({
  tenantId: z.string(),
  siteId: z.string(),
  visitorId: z.string(),
  origin: z.string(),
});

export const WidgetSocketAuthSchema = z.object({
  sessionToken: z.string().min(1),
});

export const WidgetVisitorMessageSchema = z.object({
  text: z.string().trim().min(1).max(8_000),
  clientMessageId: z.string().min(1),
});

export const WidgetMessageSenderSchema = z.enum(['visitor', 'assistant', 'agent']);

export const WidgetMessageSchema = z.object({
  id: z.string().min(1),
  sender: WidgetMessageSenderSchema,
  text: z.string(),
  createdAt: IsoDateTimeSchema,
  sources: z
    .array(z.object({ title: z.string(), url: z.string() }))
    .optional(),
  streaming: z.boolean().optional(),
});

export const WidgetMessageDeltaSchema = z.object({
  id: z.string().min(1),
  delta: z.string(),
  done: z.boolean().optional(),
});

export const WidgetChatErrorSchema = z.object({
  code: z.enum(WIDGET_ERROR_CODES),
  retryAfter: z.number().optional(),
});

export type WidgetPosition = z.infer<typeof WidgetPositionSchema>;
export type WidgetTheme = z.infer<typeof WidgetThemeSchema>;
export type WidgetCopy = z.infer<typeof WidgetCopySchema>;
export type WidgetLauncher = z.infer<typeof WidgetLauncherSchema>;
export type WidgetFeatures = z.infer<typeof WidgetFeaturesSchema>;
export type SessionPayload = z.infer<typeof SessionPayloadSchema>;
export type WidgetSocketAuth = z.infer<typeof WidgetSocketAuthSchema>;
export type WidgetVisitorMessage = z.infer<typeof WidgetVisitorMessageSchema>;
export type WidgetMessageSender = z.infer<typeof WidgetMessageSenderSchema>;
export type WidgetMessage = z.infer<typeof WidgetMessageSchema>;
export type WidgetMessageDelta = z.infer<typeof WidgetMessageDeltaSchema>;
export type WidgetChatError = z.infer<typeof WidgetChatErrorSchema>;
