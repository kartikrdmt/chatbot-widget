import type { ZodType, ZodTypeDef } from 'zod';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(
  /\/+$/,
  '',
);

const DEFAULT_TIMEOUT_MS = 6_000;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions extends Omit<RequestInit, 'signal'> {
  timeoutMs?: number;
}

export async function request<T>(
  baseUrl: string,
  path: string,
  schema: ZodType<T, ZodTypeDef, unknown>,
  { timeoutMs = DEFAULT_TIMEOUT_MS, headers, ...init }: RequestOptions = {},
): Promise<T> {
  const url = `${baseUrl}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: 'no-store',
      headers: { accept: 'application/json', ...headers },
    });

    if (!response.ok) {
      throw new ApiError(`${path} returned ${response.status}`, response.status, url);
    }

    const parsed = schema.safeParse(await response.json());
    if (!parsed.success) {
      throw new ApiError(`${path} returned an unexpected shape: ${parsed.error.message}`, 502, url);
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(`${path} timed out after ${timeoutMs}ms`, 504, url);
    }
    throw new ApiError(error instanceof Error ? error.message : String(error), 0, url);
  } finally {
    clearTimeout(timer);
  }
}
