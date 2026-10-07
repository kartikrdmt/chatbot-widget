import { z } from 'zod';

import { IsoDateTimeSchema, TenantIdSchema } from './common';

export const WIDGET_LIMITS = {
  maxMessageLength: 2_000,
  historyTurns: 10,
  maxOutputTokens: 1_024,
  visitorMessagesPerMinute: 10,
  ipMessagesPerMinute: 30,
  ipConnections: 5,
  siteMessagesPerMinute: 600,
  maxSocketBytes: 16_384,
} as const;

export const WIDGET_SOCKET_NAMESPACE = '/widget';

export const WIDGET_EVENTS = {
  visitorMessage: 'visitor:chat:message',
  message: 'chat:message',
  messageDelta: 'chat:message:delta',
  typing: 'chat:typing',
  error: 'chat:error',
  history: 'conversation:history',
  session: 'session:refresh',
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

export const RADIUS_STYLES = ['square', 'rounded', 'pill'] as const;

export const CSS_COLOR =
  /^(#[0-9a-f]{3,8}|[a-z]+|(rgb|hsl|oklch|oklab|lab|lch|hwb)a?\([0-9a-z\s.,%/+-]+\))$/i;

export const CSS_SIZE = /^\d*\.?\d+(px|%|vw|vh|dvh|rem|em)$/;

export const FONT_NAME = /^[A-Za-z0-9 ]{1,80}$/;

const colorField = z
  .string()
  .trim()
  .regex(CSS_COLOR, 'must be a plain CSS colour such as #162E56 or rgb(22 46 86)');
const fontField = z.string().trim().regex(FONT_NAME, 'letters, digits and spaces only');
const sizeField = z.string().trim().regex(CSS_SIZE, 'must be a CSS length such as 380px or 90vw');

export const WidgetThemeInputSchema = z
  .object({
    accent: colorField.optional(),
    accentForeground: colorField.optional(),
    surface: colorField.optional(),
    raised: colorField.optional(),
    foreground: colorField.optional(),
    muted: colorField.optional(),
    border: colorField.optional(),
    radius: z.enum(RADIUS_STYLES).optional(),
    font: fontField.optional(),
  })
  .strict();

export const WidgetThemeSchema = z.object({
  accent: colorField.optional().catch(undefined),
  accentForeground: colorField.optional().catch(undefined),
  surface: colorField.optional().catch(undefined),
  raised: colorField.optional().catch(undefined),
  foreground: colorField.optional().catch(undefined),
  muted: colorField.optional().catch(undefined),
  border: colorField.optional().catch(undefined),
  radius: z.enum(RADIUS_STYLES).optional().catch(undefined),
  font: fontField.optional().catch(undefined),
});

const DEFAULT_GREETING = 'Hi there! How can I help you today?';

export const WidgetCopyInputSchema = z
  .object({
    title: z.string().trim().min(1).max(80).optional(),
    subtitle: z.string().trim().min(1).max(120).optional(),
    greeting: z.string().trim().min(1).max(500).optional(),
    placeholder: z.string().trim().min(1).max(80).optional(),
    offlineMessage: z.string().trim().min(1).max(200).optional(),
    avatarText: z.string().trim().min(1).max(2).optional(),
  })
  .strict();

export const WidgetCopySchema = z.object({
  title: z.string().min(1).max(80).catch('How can we help?'),
  subtitle: z.string().max(120).optional().catch(undefined),
  greeting: z.string().min(1).max(500).catch(DEFAULT_GREETING),
  placeholder: z.string().min(1).max(80).catch('Write a message...'),
  offlineMessage: z.string().min(1).max(200).catch("We're offline right now."),
  avatarText: z.string().min(1).max(2).optional().catch(undefined),
});

export const WidgetLauncherInputSchema = z
  .object({
    position: WidgetPositionSchema.optional(),
    offset: z.number().int().min(0).max(200).optional(),
    width: sizeField.optional(),
    height: sizeField.optional(),
  })
  .strict();

export const WidgetLauncherSchema = z.object({
  position: WidgetPositionSchema.catch('bottom-right'),
  offset: z.number().int().min(0).max(200).catch(24),
  width: sizeField.catch('380px'),
  height: sizeField.catch('600px'),
});

export const WidgetFeaturesInputSchema = z
  .object({
    streaming: z.boolean().optional(),
    showSources: z.boolean().optional(),
  })
  .strict();

export const WidgetFeaturesSchema = z.object({
  streaming: z.boolean().catch(true),
  showSources: z.boolean().catch(true),
});

export const SiteSettingsInputSchema = z
  .object({
    theme: WidgetThemeInputSchema.optional(),
    copy: WidgetCopyInputSchema.optional(),
    launcher: WidgetLauncherInputSchema.optional(),
    features: WidgetFeaturesInputSchema.optional(),
    systemPrompt: z.string().trim().min(1).max(4_000).optional(),
    llmModel: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9._-]{1,80}$/, 'a model name such as gemini-3.1-flash-lite')
      .optional(),
    messagesPerMinute: z.number().int().min(1).max(600).optional(),
    messagesPerDay: z.number().int().min(1).max(100_000).optional(),
    siteMessagesPerMinute: z.number().int().min(1).max(100_000).optional(),
  })
  .strict();

export type SiteSettingsInput = z.infer<typeof SiteSettingsInputSchema>;

export const OriginSchema = z.string().refine(
  (value) => {
    try {
      return new URL(value).origin === value;
    } catch {
      return false;
    }
  },
  { message: 'must be an origin such as https://example.com, with no path or trailing slash' },
);

export const SiteStatusSchema = z.enum(['active', 'disabled']);

export const CreateSiteRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    allowedOrigins: z.array(OriginSchema).min(1).max(50),
    settings: SiteSettingsInputSchema.optional(),
  })
  .strict();

export const UpdateSiteRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    allowedOrigins: z.array(OriginSchema).min(1).max(50).optional(),
    status: SiteStatusSchema.optional(),
  })
  .strict();

export const SiteSchema = z.object({
  id: z.string().min(1),
  tenantId: TenantIdSchema,
  name: z.string(),
  publicToken: z.string().min(1),
  allowedOrigins: z.array(z.string()),
  status: SiteStatusSchema,
  settings: SiteSettingsInputSchema,
  snippet: z.string(),
});

export const CreateSiteResponseSchema = SiteSchema.extend({ secretKey: z.string().min(1) });

export const WidgetSessionSchema = z.object({
  token: z.string().min(1),
  expiresAt: IsoDateTimeSchema,
  expiresIn: z.number().int().positive().optional().catch(undefined),
});

export const WidgetConfigSchema = z.object({
  status: SiteStatusSchema.default('active').catch('disabled'),
  siteId: z.string().min(1).catch('local'),
  session: WidgetSessionSchema.optional().catch(undefined),
  visitorId: z.string().min(1).optional().catch(undefined),
  copy: WidgetCopySchema.default({}).catch(() => WidgetCopySchema.parse({})),
  theme: WidgetThemeSchema.default({}).catch(() => WidgetThemeSchema.parse({})),
  launcher: WidgetLauncherSchema.default({}).catch(() => WidgetLauncherSchema.parse({})),
  features: WidgetFeaturesSchema.default({}).catch(() => WidgetFeaturesSchema.parse({})),
});

export const WidgetAppearanceSchema = z.object({
  title: z.string().trim().min(1).max(80).optional().catch(undefined),
  subtitle: z.string().trim().min(1).max(120).optional().catch(undefined),
  greeting: z.string().trim().min(1).max(500).optional().catch(undefined),
  placeholder: z.string().trim().min(1).max(80).optional().catch(undefined),
  avatarText: z.string().trim().min(1).max(2).optional().catch(undefined),
  theme: WidgetThemeSchema.default({}),
});

export const SessionPayloadSchema = z.object({
  tenantId: TenantIdSchema,
  siteId: z.string().min(1),
  visitorId: z.string().min(1),
  origin: z.string().min(1),
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
  /** 0, 1, 2… for each piece of one reply, so the widget can drop repeats and late arrivals. */
  seq: z.number().int().nonnegative().optional(),
  delta: z.string(),
  done: z.boolean().optional(),
});

export const WidgetChatErrorSchema = z.object({
  code: z.enum(WIDGET_ERROR_CODES),
  retryAfter: z.number().optional(),
});

export const WidgetVisitorMessageSchema = z.object({
  text: z.string().trim().min(1).max(WIDGET_LIMITS.maxMessageLength),
  clientMessageId: z.string().min(1).max(100),
});

export const WidgetSessionRefreshSchema = z.object({
  sessionToken: z.string().min(1),
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
export type SessionPayload = z.infer<typeof SessionPayloadSchema>;
export type WidgetMessageSender = z.infer<typeof WidgetMessageSenderSchema>;
export type WidgetMessage = z.infer<typeof WidgetMessageSchema>;
export type WidgetMessageDelta = z.infer<typeof WidgetMessageDeltaSchema>;
export type WidgetChatError = z.infer<typeof WidgetChatErrorSchema>;
export type WidgetSource = z.infer<typeof WidgetSourceSchema>;
export type WidgetVisitorMessage = z.input<typeof WidgetVisitorMessageSchema>;
export type WidgetSessionRefresh = z.infer<typeof WidgetSessionRefreshSchema>;
export type WidgetSocketAuth = z.infer<typeof WidgetSocketAuthSchema>;
export type CreateSiteRequest = z.infer<typeof CreateSiteRequestSchema>;
export type UpdateSiteRequest = z.infer<typeof UpdateSiteRequestSchema>;
export type Site = z.infer<typeof SiteSchema>;
export type CreateSiteResponse = z.infer<typeof CreateSiteResponseSchema>;
