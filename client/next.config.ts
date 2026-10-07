import { readFileSync } from 'node:fs';
import type { NextConfig } from 'next';

// The widget is published by `npm run build:widget` (see scripts/build-widget.mjs).
const { widgetVersion } = JSON.parse(readFileSync('package.json', 'utf8')) as {
  widgetVersion: string;
};
const widgetMajor = widgetVersion.split('.')[0];

/** Customers' pages load these files from another website. */
const cors = { key: 'Access-Control-Allow-Origin', value: '*' };

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Hides the dev-only "N" badge so it doesn't sit on top of the embedded widget.
  devIndicators: false,
  async headers() {
    return [
      {
        // Aliases that always point at the newest build: the browser must check for a new one
        // (a 304 when nothing changed), so a release reaches visitors on their next page load.
        source: '/widget.js',
        headers: [cors, { key: 'Cache-Control', value: 'public, no-cache' }],
      },
      {
        source: `/v${widgetMajor}/:path*`,
        headers: [cors, { key: 'Cache-Control', value: 'public, no-cache' }],
      },
      {
        // A versioned build never changes (the chat file's name carries its content hash), so
        // browsers and CDNs may keep it for a year.
        source: `/v${widgetVersion}/:path*`,
        headers: [cors, { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
