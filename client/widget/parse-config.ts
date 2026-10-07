import { type WidgetConfig, WidgetConfigSchema } from '@myra/contracts';

/** Never throws: a config that cannot be read at all still opens the chat, with the defaults. */
export function parseConfig(raw: unknown): WidgetConfig {
  const parsed = WidgetConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : WidgetConfigSchema.parse({});
}
