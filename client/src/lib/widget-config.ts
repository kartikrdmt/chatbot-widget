import {
  DEFAULT_WIDGET_CONFIG,
  type WidgetConfig,
  WidgetConfigSchema,
} from '@/lib/contracts/widget';

import { API_URL, request } from '@/lib/api';

export const DEFAULT_WIDGET_KEY = process.env.NEXT_PUBLIC_WIDGET_KEY ?? 'demo-key';

/**
 * Never rejects: the widget has to render even while the API is down, so a
 * failed lookup falls back to the shared defaults.
 */
export async function getWidgetConfig(key: string = DEFAULT_WIDGET_KEY): Promise<WidgetConfig> {
  try {
    return await request(
      API_URL,
      `/widget/config?key=${encodeURIComponent(key)}`,
      WidgetConfigSchema,
    );
  } catch {
    return { ...DEFAULT_WIDGET_CONFIG, key };
  }
}
