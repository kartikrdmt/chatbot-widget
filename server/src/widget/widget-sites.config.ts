import { type WidgetSite, WidgetSitesSchema } from './widget-site.schema.js';

const DEVELOPMENT_SITES: WidgetSite[] = [
  {
    key: 'demo-key',
    allowedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  },
];

export function parseWidgetSites(
  raw: string | undefined,
  nodeEnv: string,
): WidgetSite[] {
  if (raw === undefined || raw.trim() === '') {
    return nodeEnv === 'development' || nodeEnv === 'test'
      ? DEVELOPMENT_SITES
      : [];
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error('WIDGET_SITES is not valid JSON.');
  }

  const parsed = WidgetSitesSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`WIDGET_SITES is invalid: ${parsed.error.message}`);
  }
  return parsed.data;
}
