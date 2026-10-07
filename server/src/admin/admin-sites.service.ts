import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import {
  type CreateSiteRequest,
  type CreateSiteResponse,
  type Site,
  type SiteSettingsInput,
  type UpdateSiteRequest,
} from '@myra/contracts';
import { isValidObjectId, type Model } from 'mongoose';

import { TenantContextService } from '../common/services/tenant-context.service.js';
import type { AppConfig } from '../config/configuration.js';
import {
  Site as SiteModel,
  type SiteDocument,
} from '../widget/schemas/site.schema.js';
import { SiteService } from '../widget/site.service.js';

const SECTIONS = ['theme', 'copy', 'launcher', 'features'] as const;

export function mergeSettings(
  current: SiteSettingsInput,
  patch: SiteSettingsInput,
): SiteSettingsInput {
  const merged: Record<string, unknown> = { ...current, ...patch };
  for (const section of SECTIONS) {
    if (patch[section])
      merged[section] = { ...current[section], ...patch[section] };
  }
  return merged as SiteSettingsInput;
}

export const hashSecret = (secret: string): string =>
  createHash('sha256').update(secret).digest('hex');

@Injectable()
export class AdminSitesService {
  constructor(
    @InjectModel(SiteModel.name)
    private readonly siteModel: Model<SiteDocument>,
    private readonly sites: SiteService,
    private readonly tenantContext: TenantContextService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async create(request: CreateSiteRequest): Promise<CreateSiteResponse> {
    const tenantId = this.tenantContext.requireTenantId();
    await this.sites.ensureTenant(tenantId);

    const secretKey = this.newSecretKey();
    const site = await this.siteModel.create({
      publicToken: this.sites.newPublicToken(),
      secretKeyHash: hashSecret(secretKey),
      name: request.name,
      allowedOrigins: request.allowedOrigins,
      status: 'active',
      settings: request.settings ?? {},
    });
    this.sites.invalidateOriginCache();
    return { ...this.toContract(site), secretKey };
  }

  async list(): Promise<Site[]> {
    const sites = await this.siteModel.find().sort({ createdAt: -1 }).exec();
    return sites.map((site) => this.toContract(site));
  }

  async get(id: string): Promise<Site> {
    return this.toContract(await this.require(id));
  }

  async update(id: string, request: UpdateSiteRequest): Promise<Site> {
    const site = await this.require(id);
    if (request.name !== undefined) site.name = request.name;
    if (request.allowedOrigins !== undefined)
      site.allowedOrigins = request.allowedOrigins;
    if (request.status !== undefined) site.status = request.status;
    await site.save();
    this.sites.invalidateOriginCache();
    return this.toContract(site);
  }

  async saveSettings(
    id: string,
    settings: SiteSettingsInput,
    merge: boolean,
  ): Promise<Site> {
    const site = await this.require(id);
    site.settings = merge
      ? mergeSettings(site.settings ?? {}, settings)
      : settings;
    site.markModified('settings');
    await site.save();
    return this.toContract(site);
  }

  async rotateSecret(id: string): Promise<CreateSiteResponse> {
    const site = await this.require(id);
    const secretKey = this.newSecretKey();
    site.secretKeyHash = hashSecret(secretKey);
    await site.save();
    return { ...this.toContract(site), secretKey };
  }

  async verifySecretKey(
    publicToken: string,
    secretKey: string,
  ): Promise<boolean> {
    const site = await this.siteModel
      .findOne({ publicToken })
      .select('+secretKeyHash')
      .exec();
    if (!site?.secretKeyHash) return false;
    const a = Buffer.from(site.secretKeyHash);
    const b = Buffer.from(hashSecret(secretKey));
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private newSecretKey(): string {
    return `sk_${randomBytes(24).toString('base64url')}`;
  }

  private async require(id: string): Promise<SiteDocument> {
    if (!isValidObjectId(id)) throw new NotFoundException('Unknown site.');
    const site = await this.siteModel.findById(id).exec();
    if (!site) throw new NotFoundException('Unknown site.');
    return site;
  }

  private toContract(site: SiteDocument): Site {
    const { publicUrl, apiPublicUrl } = this.config.get('widget', {
      infer: true,
    });
    return {
      id: site._id.toString(),
      tenantId: site.tenantId,
      name: site.name,
      publicToken: site.publicToken,
      allowedOrigins: site.allowedOrigins,
      status: site.status,
      settings: site.settings ?? {},
      snippet:
        `<script src="${publicUrl}/widget.js" data-site-token="${site.publicToken}" ` +
        `data-api-url="${apiPublicUrl}" async></script>`,
    };
  }
}
