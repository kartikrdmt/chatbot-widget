import { z } from 'zod';

import { IsoDateTimeSchema, TenantIdSchema } from './common';

/**
 * The chat widget: what the embed script reads, what the admin panel saves, and every message and
 * socket event between them.
 *
 * Two flavours of the same shapes live here, on purpose:
 *
 * - `*InputSchema` is STRICT. The admin API uses it, so a bad colour or an unknown key is rejected
 *   with a clear error and never reaches the database.
 * - The unsuffixed schemas are LENIENT. The widget uses them on whatever the server sends, so one
 *   bad stored value falls back to the default instead of breaking the whole chat.
 *
 * Keeping both next to each other is what stops the server and the widget drifting apart.
 */

/** Limits shared by the widget (input boxes) and the server (enforcement). */
export const WIDGET_LIMITS = {
  /** Longest visitor message, in characters. */
  maxMessageLength: 2_000,
  /** How many earlier messages the server gives the model as context. */
  historyTurns: 10,
  /** Cap on the model's reply, in tokens. */
  maxOutputTokens: 1_024,
  /** Messages one visitor may send per minute, unless the site says otherwise. */
  visitorMessagesPerMinute: 10,
  /** Messages one IP address may send per minute, across all visitors behind it. */
  ipMessagesPerMinute: 30,
  /** Simultaneous chat connections from one IP address. */
  ipConnections: 5,
  /** Messages a whole site may receive per minute, unless the site says otherwise. */
  siteMessagesPerMinute: 600,
  /** Largest socket message the server will accept, in bytes. */
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

/** Plain CSS colours only, because these values end up inside a style attribute. */
export const CSS_COLOR =
  /^(#[0-9a-f]{3,8}|[a-z]+|(rgb|hsl|oklch|oklab|lab|lch|hwb)a?\([0-9a-z\s.,%/+-]+\))$/i;

/** A CSS length such as `380px`, `90vw` or `100%`. Nothing that could carry other CSS. */
export const CSS_SIZE = /^\d*\.?\d+(px|%|vw|vh|dvh|rem|em)$/;

/** Letters, digits and spaces only: a font name goes into a URL and a CSS value. */
export const FONT_NAME = /^[A-Za-z0-9 ]{1,80}$/;

const colorField = z
  .string()
  .trim()
  .regex(CSS_COLOR, 'must be a plain CSS colour such as #162E56 or rgb(22 46 86)');
const fontField = z.string().trim().regex(FONT_NAME, 'letters, digits and spaces only');
const sizeField = z.string().trim().regex(CSS_SIZE, 'must be a CSS length such as 380px or 90vw');

// ---------------------------------------------------------------------------------------------
// Appearance, text, layout, features
// ---------------------------------------------------------------------------------------------

export const WidgetThemeInputSchema = z
  .object({
    /** Header, launcher, send button, visitor bubbles, bot avatar. */
    accent: colorField.optional(),
    /** Text and icons drawn on top of the accent colour. */
    accentForeground: colorField.optional(),
    /** Chat window and bot bubbles. */
    surface: colorField.optional(),
    /** The area behind the messages. */
    raised: colorField.optional(),
    /** Main text. */
    foreground: colorField.optional(),
    /** Timestamps and placeholder. */
    muted: colorField.optional(),
    /** Borders and dividers. */
    border: colorField.optional(),
    radius: z.enum(RADIUS_STYLES).optional(),
    /** A Google Font family name. */
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
    /** One or two letters in the bot's avatar. Defaults to the first letter of the title. */
    avatarText: z.string().trim().min(1).max(2).optional(),
  })
  .strict();

export const WidgetCopySchema = z.object({
  title: z.string().min(1).max(80).default('How can we help?'),
  subtitle: z.string().max(120).optional(),
  greeting: z.string().min(1).max(500).default(DEFAULT_GREETING),
  placeholder: z.string().min(1).max(80).default('Write a message...'),
  offlineMessage: z.string().min(1).max(200).default("We're offline right now."),
  avatarText: z.string().min(1).max(2).optional(),
});

export const WidgetLauncherInputSchema = z
  .object({
    position: WidgetPositionSchema.optional(),
    /** Gap from the screen edge, in pixels. */
    offset: z.number().int().min(0).max(200).optional(),
    width: sizeField.optional(),
    height: sizeField.optional(),
  })
  .strict();

export const WidgetLauncherSchema = z.object({
  position: WidgetPositionSchema.default('bottom-right'),
  offset: z.number().int().min(0).max(200).default(24),
  width: z.string().default('380px'),
  height: z.string().default('600px'),
});

export const WidgetFeaturesInputSchema = z
  .object({
    streaming: z.boolean().optional(),
    showSources: z.boolean().optional(),
  })
  .strict();

export const WidgetFeaturesSchema = z.object({
  streaming: z.boolean().default(true),
  showSources: z.boolean().default(true),
});

// ---------------------------------------------------------------------------------------------
// Site settings: everything an admin can change for one site
// ---------------------------------------------------------------------------------------------

/**
 * The part of a site's settings the admin panel writes. `theme`, `copy`, `launcher` and `features`
 * are sent to the widget; the rest stays on the server.
 */
export const SiteSettingsInputSchema = z
  .object({
    theme: WidgetThemeInputSchema.optional(),
    copy: WidgetCopyInputSchema.optional(),
    launcher: WidgetLauncherInputSchema.optional(),
    features: WidgetFeaturesInputSchema.optional(),
    /** The customer's tone and topics. Sits inside the platform's fixed safety rules. */
    systemPrompt: z.string().trim().min(1).max(4_000).optional(),
    /** Overrides the platform's default model for this site. */
    llmModel: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9._-]{1,80}$/, 'a model name such as gemini-3.1-flash-lite')
      .optional(),
    /** Messages one visitor may send per minute. */
    messagesPerMinute: z.number().int().min(1).max(600).optional(),
    /** Messages one visitor may send per day. */
    messagesPerDay: z.number().int().min(1).max(100_000).optional(),
    /** Messages the whole site may receive per minute, from all its visitors together. */
    siteMessagesPerMinute: z.number().int().min(1).max(100_000).optional(),
  })
  .strict();

export type SiteSettingsInput = z.infer<typeof SiteSettingsInputSchema>;

/** An allowed website: an exact origin with no path and no trailing slash. */
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
    /** `disabled` is the emergency switch: the widget stops appearing and chats are refused. */
    status: SiteStatusSchema.optional(),
  })
  .strict();

export const SiteSchema = z.object({
  id: z.string().min(1),
  tenantId: TenantIdSchema,
  name: z.string(),
  /** Public token for the embed snippet. Not a secret. */
  publicToken: z.string().min(1),
  allowedOrigins: z.array(z.string()),
  status: SiteStatusSchema,
  settings: SiteSettingsInputSchema,
  /** Ready-to-paste embed snippet. */
  snippet: z.string(),
});

/** Returned once, when a site is created or its secret is rotated. Only a hash is stored. */
export const CreateSiteResponseSchema = SiteSchema.extend({ secretKey: z.string().min(1) });

// ---------------------------------------------------------------------------------------------
// What the widget receives
// ---------------------------------------------------------------------------------------------

export const WidgetSessionSchema = z.object({
  token: z.string().min(1),
  expiresAt: IsoDateTimeSchema,
});

export const WidgetConfigSchema = z.object({
  status: SiteStatusSchema.default('active'),
  siteId: z.string().min(1).default('local'),
  session: WidgetSessionSchema.optional(),
  visitorId: z.string().min(1).optional(),
  copy: WidgetCopySchema.default({}),
  theme: WidgetThemeSchema.default({}),
  launcher: WidgetLauncherSchema.default({}),
  features: WidgetFeaturesSchema.default({}),
});

/** What the embedding page can set as `data-*` attributes or React props. They override the server. */
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

// ---------------------------------------------------------------------------------------------
// Messages and socket events
// ---------------------------------------------------------------------------------------------

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
export type WidgetSocketAuth = z.infer<typeof WidgetSocketAuthSchema>;
export type CreateSiteRequest = z.infer<typeof CreateSiteRequestSchema>;
export type UpdateSiteRequest = z.infer<typeof UpdateSiteRequestSchema>;
export type Site = z.infer<typeof SiteSchema>;
export type CreateSiteResponse = z.infer<typeof CreateSiteResponseSchema>;
