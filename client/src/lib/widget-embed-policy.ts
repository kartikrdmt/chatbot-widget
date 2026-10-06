import { type WidgetEmbedPolicy, WidgetEmbedPolicySchema } from '@/lib/contracts/widget';

import { API_URL, request } from '@/lib/api';

/** Null when the key is unknown or the API cannot be reached, so callers fail closed. */
export async function getWidgetEmbedPolicy(key: string): Promise<WidgetEmbedPolicy | null> {
  try {
    return await request(
      API_URL,
      `/widget/embed-policy?key=${encodeURIComponent(key)}`,
      WidgetEmbedPolicySchema,
    );
  } catch {
    return null;
  }
}
