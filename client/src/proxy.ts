import { type NextRequest, NextResponse } from 'next/server';

import { DEFAULT_WIDGET_KEY } from '@/lib/widget-config';
import { getWidgetEmbedPolicy } from '@/lib/widget-embed-policy';

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const key = request.nextUrl.searchParams.get('key')?.trim() || DEFAULT_WIDGET_KEY;
  const policy = await getWidgetEmbedPolicy(key);

  if (!policy) {
    return new NextResponse('This chat widget is not available.', {
      status: 403,
    });
  }

  const response = NextResponse.next();
  response.headers.set(
    'Content-Security-Policy',
    `frame-ancestors 'self' ${policy.allowedOrigins.join(' ')}`,
  );
  return response;
}

export const config = { matcher: '/embed' };
