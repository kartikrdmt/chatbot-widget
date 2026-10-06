import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';

import { GeminiService } from './gemini.service.js';
import type { SessionService } from './session.service.js';
import type { SiteDocument } from './schemas/site.schema.js';
import type { SiteService } from './site.service.js';
import { WidgetController } from './widget.controller.js';
import { WidgetService } from './widget.service.js';

const DEMO_SITE = {
  _id: { toString: () => 'site-1' },
  tenantId: { toString: () => 'tenant-1' },
  publicToken: 'st_acme',
  name: 'Acme',
  allowedOrigins: ['https://acme.com'],
  status: 'active',
  settings: {},
} as unknown as SiteDocument;

const MOCK_SESSION = {
  token: 'jwt.token.here',
  expiresAt: '2099-01-01T00:00:00.000Z',
};

const makeSites = (
  overrides: Partial<typeof mockSites> = {},
): typeof mockSites => ({ ...mockSites, ...overrides });

const mockSites = {
  findByToken: vi.fn().mockResolvedValue(DEMO_SITE),
  isOriginAllowed: vi.fn().mockReturnValue(true),
  createVisitor: vi.fn().mockResolvedValue('v_test'),
  touchVisitor: vi.fn().mockResolvedValue(undefined),
};

const mockSession = {
  create: vi.fn().mockReturnValue(MOCK_SESSION),
};

const buildController = (sitesOverride = {}) =>
  new WidgetController(
    new WidgetService(new GeminiService()),
    makeSites(sitesOverride) as unknown as SiteService,
    mockSession as unknown as SessionService,
  );

const buildResponse = () => {
  const headers: Record<string, string> = {};
  const response = {
    setHeader: (name: string, value: string) => {
      headers[name] = value;
    },
    vary: vi.fn(),
  } as unknown as Response;
  return { response, headers };
};

describe('WidgetController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSites.findByToken.mockResolvedValue(DEMO_SITE);
    mockSites.isOriginAllowed.mockReturnValue(true);
    mockSites.createVisitor.mockResolvedValue('v_test');
    mockSession.create.mockReturnValue(MOCK_SESSION);
  });

  it('returns config for a valid token + origin', async () => {
    const { response } = buildResponse();
    const config = await buildController().getConfig(
      'st_acme',
      undefined,
      'https://acme.com',
      response,
    );
    expect(config.siteId).toBe('site-1');
    expect(config.session).toEqual(MOCK_SESSION);
    expect(config.visitorId).toBe('v_test');
  });

  it('rejects a missing token with 400', async () => {
    const { response } = buildResponse();
    await expect(
      buildController().getConfig(undefined, undefined, 'https://acme.com', response),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a missing Origin with 403', async () => {
    const { response } = buildResponse();
    await expect(
      buildController().getConfig('st_acme', undefined, undefined, response),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects an unknown token with 404', async () => {
    mockSites.findByToken.mockResolvedValue(null);
    const { response } = buildResponse();
    await expect(
      buildController().getConfig('st_nope', undefined, 'https://acme.com', response),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects a disallowed origin with 403', async () => {
    mockSites.isOriginAllowed.mockReturnValue(false);
    const { response } = buildResponse();
    await expect(
      buildController().getConfig('st_acme', undefined, 'https://evil.com', response),
    ).rejects.toThrow(ForbiddenException);
  });

  it('reflects the Origin header for CORS', async () => {
    const { response, headers } = buildResponse();
    await buildController().getConfig(
      'st_acme',
      undefined,
      'https://acme.com',
      response,
    );
    expect(headers['Access-Control-Allow-Origin']).toBe('https://acme.com');
  });

  it('reuses an existing visitorId when provided', async () => {
    const { response } = buildResponse();
    const config = await buildController().getConfig(
      'st_acme',
      'v_existing',
      'https://acme.com',
      response,
    );
    expect(mockSites.createVisitor).not.toHaveBeenCalled();
    expect(mockSites.touchVisitor).toHaveBeenCalledWith('v_existing');
    expect(config.visitorId).toBe('v_existing');
  });
});
