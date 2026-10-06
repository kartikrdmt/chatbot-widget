import { z } from 'zod';

const IsoDateTimeSchema = z.string().datetime({ offset: true });

const DEFAULT_GREETING = 'Hi there! How can I help you today?';

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

export const POSITIONS = [
  'bottom-right',
  'bottom-left',
  'bottom-center',
  'top-right',
  'top-left',
  'top-center',
  'left-center',
  'right-center',
] as const;

export const WidgetPositionSchema = z.enum(POSITIONS);

/** Plain CSS colours only, because these values end up inside a style attribute. */
const CSS_COLOR =
  /^(#[0-9a-f]{3,8}|[a-z]+|(rgb|hsl|oklch|oklab|lab|lch|hwb)a?\([0-9a-z\s.,%/+-]+\))$/i;

const ColorSchema = z.string().trim().regex(CSS_COLOR).optional().catch(undefined);

export const WidgetThemeSchema = z.object({
  accent: ColorSchema,
  accentForeground: ColorSchema,
  surface: ColorSchema,
  raised: ColorSchema,
  foreground: ColorSchema,
  muted: ColorSchema,
  border: ColorSchema,
  radius: z.enum(['square', 'rounded', 'pill']).optional().catch(undefined),
  font: z.string().trim().min(1).max(80).optional().catch(undefined),
});

export const WidgetCopySchema = z.object({
  title: z.string().min(1).max(80).default('How can we help?'),
  subtitle: z.string().max(120).optional(),
  greeting: z.string().min(1).max(500).default(DEFAULT_GREETING),
  placeholder: z.string().min(1).max(80).default('Write a message...'),
  offlineMessage: z.string().min(1).max(200).default("We're offline right now."),
  avatarText: z.string().min(1).max(2).optional(),
});

export const WidgetLauncherSchema = z.object({
  position: WidgetPositionSchema.default('bottom-right'),
  offset: z.number().int().min(0).max(200).default(24),
  width: z.string().default('380px'),
  height: z.string().default('600px'),
});

export const WidgetFeaturesSchema = z.object({
  streaming: z.boolean().default(true),
  showSources: z.boolean().default(true),
});

export const WidgetSessionSchema = z.object({
  token: z.string().min(1),
  expiresAt: IsoDateTimeSchema,
});

export const WidgetConfigSchema = z.object({
  status: z.enum(['active', 'disabled']).default('active'),
  siteId: z.string().min(1).default('local'),
  session: WidgetSessionSchema.optional(),
  visitorId: z.string().min(1).optional(),
  copy: WidgetCopySchema.default({}),
  theme: WidgetThemeSchema.default({}),
  launcher: WidgetLauncherSchema.default({}),
  features: WidgetFeaturesSchema.default({}),
});

/** What the embedding page can set as data-* attributes or React props (overrides server settings). */
export const WidgetAppearanceSchema = z.object({
  title: z.string().trim().min(1).max(80).optional().catch(undefined),
  subtitle: z.string().trim().min(1).max(120).optional().catch(undefined),
  greeting: z.string().trim().min(1).max(500).optional().catch(undefined),
  placeholder: z.string().trim().min(1).max(80).optional().catch(undefined),
  avatarText: z.string().trim().min(1).max(2).optional().catch(undefined),
  theme: WidgetThemeSchema.default({}),
});

export const WidgetEmbedPolicySchema = z.object({
  allowedOrigins: z.array(z.string().min(1)),
});

export const WidgetMessageSenderSchema = z.enum(['visitor', 'assistant', 'agent']);

export const WidgetSourceSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
});

export const WidgetMessageSchema = z.object({
  id: z.string().min(1),
  sender: WidgetMessageSenderSchema,
  text: z.string(),
  createdAt: IsoDateTimeSchema,
  sources: z.array(WidgetSourceSchema).optional(),
  streaming: z.boolean().optional(),
});

export const WidgetMessageDeltaSchema = z.object({
  id: z.string().min(1),
  delta: z.string(),
});

export const WidgetChatErrorSchema = z.object({
  code: z.enum(WIDGET_ERROR_CODES),
  retryAfter: z.number().optional(),
});

export const WidgetVisitorMessageSchema = z.object({
  text: z.string().trim().min(1).max(8_000),
  clientMessageId: z.string().min(1),
});

export const WidgetSocketAuthSchema = z.object({
  sessionToken: z.string().min(1),
});

export const DEFAULT_WIDGET_CONFIG: WidgetConfig = {
  status: 'active',
  siteId: 'demo',
  copy: WidgetCopySchema.parse({}),
  theme: {},
  launcher: WidgetLauncherSchema.parse({}),
  features: WidgetFeaturesSchema.parse({}),
};

export type WidgetPosition = z.infer<typeof WidgetPositionSchema>;
export type WidgetConfig = z.infer<typeof WidgetConfigSchema>;
export type WidgetTheme = z.infer<typeof WidgetThemeSchema>;
export type WidgetAppearance = z.infer<typeof WidgetAppearanceSchema>;
export type WidgetCopy = z.infer<typeof WidgetCopySchema>;
export type WidgetLauncher = z.infer<typeof WidgetLauncherSchema>;
export type WidgetFeatures = z.infer<typeof WidgetFeaturesSchema>;
export type WidgetSession = z.infer<typeof WidgetSessionSchema>;
export type WidgetEmbedPolicy = z.infer<typeof WidgetEmbedPolicySchema>;
export type WidgetMessageSender = z.infer<typeof WidgetMessageSenderSchema>;
export type WidgetMessage = z.infer<typeof WidgetMessageSchema>;
export type WidgetMessageDelta = z.infer<typeof WidgetMessageDeltaSchema>;
export type WidgetChatError = z.infer<typeof WidgetChatErrorSchema>;
export type WidgetSource = z.infer<typeof WidgetSourceSchema>;
export type WidgetVisitorMessage = z.input<typeof WidgetVisitorMessageSchema>;
export type WidgetSocketAuth = z.infer<typeof WidgetSocketAuthSchema>;
