import {
  type ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { SiteSettingsInputSchema } from '@myra/contracts';

import type { AppConfig } from '../config/configuration.js';
import type { TenantContextService } from '../common/services/tenant-context.service.js';
import type { SiteService } from '../widget/site.service.js';
import { AdminGuard } from './admin.guard.js';
import {
  AdminSitesService,
  hashSecret,
  mergeSettings,
} from './admin-sites.service.js';
import { ZodValidationPipe } from './zod-validation.pipe.js';

const config = (apiKey: string) =>
  ({
    get: (key: string) =>
      key === 'admin'
        ? { apiKey }
        : {
            publicUrl: 'https://widget.test',
            apiPublicUrl: 'https://api.test',
          },
  }) as unknown as ConfigService<AppConfig, true>;

const requestWith = (key?: string) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers: key ? { 'x-admin-key': key } : {} }),
    }),
  }) as unknown as ExecutionContext;

describe('AdminGuard', () => {
  it('is off until ADMIN_API_KEY is set', () => {
    expect(() =>
      new AdminGuard(config('')).canActivate(requestWith('anything')),
    ).toThrow(ForbiddenException);
  });

  it('refuses a missing or wrong key', () => {
    const guard = new AdminGuard(config('secret-key'));
    expect(() => guard.canActivate(requestWith())).toThrow(
      UnauthorizedException,
    );
    expect(() => guard.canActivate(requestWith('secret-kez'))).toThrow(
      UnauthorizedException,
    );
  });

  it('lets the right key through', () => {
    expect(
      new AdminGuard(config('secret-key')).canActivate(
        requestWith('secret-key'),
      ),
    ).toBe(true);
  });
});

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(SiteSettingsInputSchema);

  it('explains exactly what is wrong', () => {
    try {
      pipe.transform({ theme: { accent: 'red; evil' } });
      throw new Error('should have thrown');
    } catch (error) {
      const response = (
        error as { getResponse: () => { issues: { path: string }[] } }
      ).getResponse();
      expect(response.issues[0]?.path).toBe('theme.accent');
    }
  });

  it('passes a valid body through', () => {
    expect(pipe.transform({ theme: { accent: '#162E56' } })).toEqual({
      theme: { accent: '#162E56' },
    });
  });
});

describe('mergeSettings (PATCH)', () => {
  it('changes one colour and keeps the rest', () => {
    const merged = mergeSettings(
      {
        theme: { accent: '#111111', radius: 'pill' },
        copy: { title: 'Old' },
        messagesPerMinute: 5,
      },
      { theme: { accent: '#162E56' } },
    );
    expect(merged).toEqual({
      theme: { accent: '#162E56', radius: 'pill' },
      copy: { title: 'Old' },
      messagesPerMinute: 5,
    });
  });

  it('replaces a plain value', () => {
    expect(
      mergeSettings({ messagesPerMinute: 5 }, { messagesPerMinute: 9 }),
    ).toEqual({
      messagesPerMinute: 9,
    });
  });
});

/** A tiny in-memory stand-in for the Mongoose model: enough for the service's own logic. */
function fakeModel() {
  const docs: Record<string, unknown>[] = [];
  const make = (data: Record<string, unknown>) => {
    const doc: Record<string, unknown> = {
      _id: {
        toString: () =>
          `5f0000000000000000000${String(docs.length).padStart(3, '0')}`,
      },
      tenantId: 'tenant-1',
      ...data,
      save: async () => doc,
      markModified: () => undefined,
    };
    return doc;
  };
  return {
    docs,
    create: async (data: Record<string, unknown>) => {
      const doc = make(data);
      docs.push(doc);
      return doc;
    },
    find: () => ({ sort: () => ({ exec: async () => docs }) }),
    findById: (id: string) => ({
      exec: async () =>
        docs.find(
          (d) => (d._id as { toString: () => string }).toString() === id,
        ) ?? null,
    }),
    findOne: (filter: { publicToken: string }) => ({
      select: () => ({
        exec: async () =>
          docs.find((d) => d.publicToken === filter.publicToken) ?? null,
      }),
    }),
  };
}

const buildService = () => {
  const model = fakeModel();
  const sites = {
    ensureTenant: vi.fn(),
    newPublicToken: () => 'st_testtoken000000',
    invalidateOriginCache: vi.fn(),
  };
  const tenant = { requireTenantId: () => 'tenant-1' };
  const service = new AdminSitesService(
    model as never,
    sites as unknown as SiteService,
    tenant as unknown as TenantContextService,
    config('k'),
  );
  return { service, model, sites };
};

describe('AdminSitesService', () => {
  it('shows the secret key once and stores only its hash', async () => {
    const { service, model } = buildService();
    const created = await service.create({
      name: 'Acme',
      allowedOrigins: ['https://acme.com'],
    });

    expect(created.secretKey).toMatch(/^sk_/);
    const stored = model.docs[0] as { secretKeyHash: string };
    expect(stored.secretKeyHash).toBe(hashSecret(created.secretKey));
    expect(JSON.stringify(stored)).not.toContain(created.secretKey);
    expect(JSON.stringify(await service.get(created.id))).not.toContain(
      created.secretKey,
    );
  });

  it('builds a ready-to-paste snippet from the public addresses', async () => {
    const { service } = buildService();
    const created = await service.create({
      name: 'Acme',
      allowedOrigins: ['https://acme.com'],
    });
    expect(created.snippet).toBe(
      '<script src="https://widget.test/widget.js" data-site-token="st_testtoken000000" data-api-url="https://api.test" async></script>',
    );
  });

  it('checks a secret key, and rotating invalidates the old one', async () => {
    const { service } = buildService();
    const created = await service.create({
      name: 'Acme',
      allowedOrigins: ['https://acme.com'],
    });
    expect(
      await service.verifySecretKey(created.publicToken, created.secretKey),
    ).toBe(true);
    expect(await service.verifySecretKey(created.publicToken, 'sk_wrong')).toBe(
      false,
    );

    const rotated = await service.rotateSecret(created.id);
    expect(rotated.secretKey).not.toBe(created.secretKey);
    expect(
      await service.verifySecretKey(created.publicToken, created.secretKey),
    ).toBe(false);
    expect(
      await service.verifySecretKey(created.publicToken, rotated.secretKey),
    ).toBe(true);
  });

  it('merges on PATCH and replaces on PUT', async () => {
    const { service } = buildService();
    const { id } = await service.create({
      name: 'Acme',
      allowedOrigins: ['https://acme.com'],
      settings: { theme: { accent: '#111111', radius: 'pill' } },
    });
    expect(
      (await service.saveSettings(id, { theme: { accent: '#162E56' } }, true))
        .settings,
    ).toEqual({
      theme: { accent: '#162E56', radius: 'pill' },
    });
    expect(
      (await service.saveSettings(id, { theme: { accent: '#222222' } }, false))
        .settings,
    ).toEqual({
      theme: { accent: '#222222' },
    });
  });

  it('turns the emergency switch on and off, and refreshes the CORS cache when sites change', async () => {
    const { service, sites } = buildService();
    const { id } = await service.create({
      name: 'Acme',
      allowedOrigins: ['https://acme.com'],
    });
    sites.invalidateOriginCache.mockClear();

    expect((await service.update(id, { status: 'disabled' })).status).toBe(
      'disabled',
    );
    expect(
      (await service.update(id, { allowedOrigins: ['https://new.com'] }))
        .allowedOrigins,
    ).toEqual(['https://new.com']);
    expect(sites.invalidateOriginCache).toHaveBeenCalledTimes(2);
  });

  it('treats a bad or unknown id as not found', async () => {
    const { service } = buildService();
    await expect(service.get('not-an-id')).rejects.toThrow('Unknown site');
    await expect(service.get('5f00000000000000000fffff')).rejects.toThrow(
      'Unknown site',
    );
  });
});
