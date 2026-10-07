const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value.trim() === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

const toList = (value: string | undefined, fallback: string[]): string[] => {
  const items = (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : fallback;
};

export interface AppConfig {
  nodeEnv: string;
  port: number;
  corsOrigins: string[];
  trustProxy: boolean;
  mongodb: {
    uri: string;
    dbName?: string;
    serverSelectionTimeoutMs: number;
  };
  engine: {
    url: string;
    timeoutMs: number;
  };
  widget: {
    jwtSecret: string;
    answerProvider: 'gemini' | 'engine';
    publicUrl: string;
    apiPublicUrl: string;
  };
  admin: {
    apiKey: string;
  };
  tenancy: {
    header: string;
    defaultTenantId: string;
    allowDefaultTenant: boolean;
  };
}

export const configuration = (): AppConfig => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const port = toInt(process.env.API_PORT ?? process.env.PORT, 4000);

  return {
    nodeEnv,
    port,
    trustProxy: toBool(process.env.TRUST_PROXY, false),
    corsOrigins: toList(process.env.CORS_ORIGINS, [
      'http://localhost:3000',
    ]).map((o) => o.toLowerCase()),
    mongodb: {
      uri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/chatbot',
      dbName: process.env.MONGODB_DB?.trim() || undefined,
      serverSelectionTimeoutMs: toInt(process.env.MONGODB_TIMEOUT_MS, 5000),
    },
    engine: {
      url: (process.env.ENGINE_URL ?? 'http://localhost:8000').replace(
        /\/+$/,
        '',
      ),
      timeoutMs: toInt(process.env.ENGINE_TIMEOUT_MS, 15000),
    },
    widget: {
      jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
      answerProvider:
        process.env.ANSWER_PROVIDER === 'engine' ? 'engine' : 'gemini',
      publicUrl: (
        process.env.WIDGET_PUBLIC_URL ?? 'http://localhost:3000'
      ).replace(/\/+$/, ''),
      apiPublicUrl: (
        process.env.API_PUBLIC_URL ?? `http://localhost:${port}`
      ).replace(/\/+$/, ''),
    },
    admin: {
      apiKey: process.env.ADMIN_API_KEY ?? '',
    },
    tenancy: {
      header: (process.env.TENANT_HEADER ?? 'x-tenant-id').toLowerCase(),
      defaultTenantId: process.env.DEFAULT_TENANT_ID ?? 'demo-tenant',
      // Fails closed: an unset NODE_ENV in production must not make the tenant header optional.
      allowDefaultTenant: toBool(
        process.env.ALLOW_DEFAULT_TENANT,
        nodeEnv === 'development' || nodeEnv === 'test',
      ),
    },
  };
};
