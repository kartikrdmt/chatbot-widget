import Script from 'next/script';

import { API_URL } from '@/lib/api';
import { DEFAULT_WIDGET_KEY } from '@/lib/widget-config';

export default function HomePage(): React.ReactElement {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-100 px-6 py-12 text-center text-[#162E56]">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Myra Technolabs</h1>
      <p className="mt-4 max-w-md text-base text-[#162E56]/70">
        Have a question? Our AI assistant is at the bottom right of the page. Click the chat button
        to start a conversation.
      </p>

      {/* The same tag a customer pastes: just the token. The look and texts come from this site's
          settings in the database (see /admin/sites). */}
      <Script
        src="/widget.js"
        strategy="afterInteractive"
        data-site-token={DEFAULT_WIDGET_KEY}
        data-api-url={API_URL}
      />
    </main>
  );
}
