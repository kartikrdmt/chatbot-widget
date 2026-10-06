import { ChatWidget } from '@/components/chat-widget';
import { getWidgetConfig } from '@/lib/widget-config';

export const dynamic = 'force-dynamic';

export default async function HomePage(): Promise<React.ReactElement> {
  const widgetConfig = await getWidgetConfig();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Chatbot widget</h1>
      <p className="mt-2 text-sm text-neutral-600">
        The chat button is in the corner. Open <code>/embed-demo.html</code> to see the same widget
        added to a plain page with one script tag.
      </p>
      <ChatWidget config={widgetConfig} />
    </main>
  );
}
