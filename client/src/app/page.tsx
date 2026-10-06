import Script from 'next/script';

import { API_URL } from '@/lib/api';
import { DEFAULT_WIDGET_KEY } from '@/lib/widget-config';

export default function HomePage(): React.ReactElement {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Chatbot widget</h1>
      <p className="mt-2 text-sm text-neutral-600">
        The chat button in the corner is the real embeddable widget, added to this page with one
        script tag and themed from its <code>data-*</code> attributes. Open{' '}
        <code>/embed-demo.html</code> to see the same tag on a plain HTML page.
      </p>

      {/* The same tag a customer would paste into their own site. */}
      <Script
        src="/widget.js"
        strategy="afterInteractive"
        data-key={DEFAULT_WIDGET_KEY}
        data-api-url={API_URL}
        data-title="Myra Technolabs"
        data-subtitle="AI assistant · replies instantly"
        data-greeting="Hi! I'm the Myra Technolabs assistant. Ask me anything."
        data-placeholder="Type your question..."
        data-avatar-text="M"
        data-accent-color="#ea7a2d"
        data-accent-text-color="#ffffff"
        data-background-color="#ffffff"
        data-chat-background-color="#fff7ed"
        data-text-color="#5c2e0e"
        data-muted-color="#b08968"
        data-border-color="#fde3cc"
      />
    </main>
  );
}
