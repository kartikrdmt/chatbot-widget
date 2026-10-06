import { ChatEmbed } from '@/components/chat-widget';
import { parseWidgetAppearance } from '@/lib/widget-appearance';
import { DEFAULT_WIDGET_KEY, getWidgetConfig } from '@/lib/widget-config';

export const dynamic = 'force-dynamic';

export default async function EmbedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement> {
  const params = await searchParams;
  const key = Array.isArray(params.key) ? params.key[0] : params.key;
  const config = await getWidgetConfig(key?.trim() || DEFAULT_WIDGET_KEY);

  return (
    <ChatEmbed
      config={config}
      appearance={parseWidgetAppearance(params)}
      inline={params.inline === '1'}
    />
  );
}
