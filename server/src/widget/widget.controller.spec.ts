import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';

import { GeminiService } from './gemini.service.js';
import { WidgetController } from './widget.controller.js';
import { WidgetService } from './widget.service.js';
import { WidgetSitesService } from './widget-sites.service.js';

const buildController = (): WidgetController => {
  process.env.WIDGET_SITES = JSON.stringify([
    { key: 'acme', allowedOrigins: ['https://acme.com'], position: 'top-left' },
  ]);
  return new WidgetController(
    new WidgetService(new GeminiService()),
    new WidgetSitesService(),
  );
};

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
  afterEach(() => {
    delete process.env.WIDGET_SITES;
  });

  it('returns the site config, with its own position', () => {
    const { response } = buildResponse();
    const config = buildController().getConfig('acme', undefined, response);
    expect(config.key).toBe('acme');
    expect(config.position).toBe('top-left');
  });

  it('rejects a missing key with 400 and an unknown key with 404', () => {
    const { response } = buildResponse();
    const controller = buildController();
    expect(() => controller.getConfig(undefined, undefined, response)).toThrow(
      BadRequestException,
    );
    expect(() => controller.getConfig('nope', undefined, response)).toThrow(
      NotFoundException,
    );
  });

  it('allows a listed origin and reflects it for CORS', () => {
    const { response, headers } = buildResponse();
    buildController().getConfig('acme', 'https://acme.com', response);
    expect(headers['Access-Control-Allow-Origin']).toBe('https://acme.com');
  });

  it('rejects an origin that is not on the key allow-list', () => {
    const { response, headers } = buildResponse();
    expect(() =>
      buildController().getConfig('acme', 'https://evil.com', response),
    ).toThrow(ForbiddenException);
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('serves the embed policy only for a known key', () => {
    const controller = buildController();
    expect(controller.getEmbedPolicy('acme')).toEqual({
      allowedOrigins: ['https://acme.com'],
    });
    expect(() => controller.getEmbedPolicy('nope')).toThrow(NotFoundException);
  });
});
