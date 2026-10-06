import Script from 'next/script';

import { API_URL } from '@/lib/api';
import { DEFAULT_WIDGET_KEY } from '@/lib/widget-config';

export default function HomePage(): React.ReactElement {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-gradient-to-br from-green-50 via-white to-emerald-100 px-6 py-12 text-center text-green-950">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Myra Technolabs</h1>
      <p className="mt-4 max-w-md text-base text-green-900/70">
        Have a question? Our AI assistant is at the bottom right of the page. Click the chat button
        to start a conversation.
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
        data-accent-color="#16a34a"
        data-accent-text-color="#ffffff"
        data-background-color="#ffffff"
        data-chat-background-color="#f0fdf4"
        data-text-color="#14532d"
        data-muted-color="#6f9a80"
        data-border-color="#cdeed9"
      />
    </main>
  );
}
