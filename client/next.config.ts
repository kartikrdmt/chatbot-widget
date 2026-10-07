import { readFileSync } from 'node:fs';
import type { NextConfig } from 'next';

const { widgetVersion } = JSON.parse(readFileSync('package.json', 'utf8')) as {
  widgetVersion: string;
};
const widgetMajor = widgetVersion.split('.')[0];

const cors = { key: 'Access-Control-Allow-Origin', value: '*' };

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  async headers() {
    return [
      {
        source: '/widget.js',
        headers: [cors, { key: 'Cache-Control', value: 'public, no-cache' }],
      },
      {
        source: `/v${widgetMajor}/:path*`,
        headers: [cors, { key: 'Cache-Control', value: 'public, no-cache' }],
      },
      {
        source: `/v${widgetVersion}/:path*`,
        headers: [cors, { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
