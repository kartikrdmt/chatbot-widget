import { randomBytes, randomUUID } from 'node:crypto';

import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';

import type { AppConfig } from '../config/configuration.js';
import { TenantContextService } from '../common/services/tenant-context.service.js';
import { DEMO_SITE_SETTINGS } from './demo-site.js';
import { Site, type SiteDocument } from './schemas/site.schema.js';
import { Tenant, type TenantDocument } from './schemas/tenant.schema.js';
import { Visitor, type VisitorDocument } from './schemas/visitor.schema.js';

const normalizeOrigin = (origin: string): string => origin.trim().toLowerCase();

const ORIGIN_CACHE_MS = 30_000;

@Injectable()
export class SiteService implements OnModuleInit {
  private originCache: { at: number; origins: Set<string> } | null = null;

  constructor(
    @InjectModel(Site.name) private readonly siteModel: Model<SiteDocument>,
    @InjectModel(Tenant.name)
    private readonly tenantModel: Model<TenantDocument>,
    @InjectModel(Visitor.name)
    private readonly visitorModel: Model<VisitorDocument>,
    private readonly tenantContext: TenantContextService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    const nodeEnv = this.config.get('nodeEnv', { infer: true });
    if (nodeEnv === 'development' || nodeEnv === 'test')
      await this.seedDemoSite();
  }

  /** Unscoped on purpose: the token is how the tenant is found. */
  async findByToken(token: string): Promise<SiteDocument | null> {
    return this.siteModel
      .findOne({ publicToken: token })
      .setOptions({ skipTenant: true })
      .exec();
  }

  async findById(id: string): Promise<SiteDocument | null> {
    return this.siteModel.findById(id).exec();
  }

  isOriginAllowed(site: SiteDocument, origin: string): boolean {
    const candidate = normalizeOrigin(origin);
    return site.allowedOrigins.some((o) => normalizeOrigin(o) === candidate);
  }

  /** Unscoped on purpose: CORS needs every site's origins. */
  async allOrigins(): Promise<string[]> {
    const sites = await this.siteModel
      .find({}, { allowedOrigins: 1 })
      .setOptions({ skipTenant: true })
      .lean()
      .exec();
    return sites.flatMap((s) => s.allowedOrigins);
  }

  async isKnownOrigin(origin: string): Promise<boolean> {
    const now = Date.now();
    if (!this.originCache || now - this.originCache.at > ORIGIN_CACHE_MS) {
      const origins = await this.allOrigins();
      this.originCache = {
        at: now,
        origins: new Set(origins.map(normalizeOrigin)),
      };
    }
    return this.originCache.origins.has(normalizeOrigin(origin));
  }

  invalidateOriginCache(): void {
    this.originCache = null;
  }

  async resolveVisitor(
    siteId: string,
    requestedVisitorId?: string,
  ): Promise<string> {
    const siteObjectId = new Types.ObjectId(siteId);
    const requested = requestedVisitorId?.trim();
    if (requested) {
      const existing = await this.visitorModel
        .findOneAndUpdate(
          { visitorId: requested, siteId: siteObjectId },
          { $set: { lastSeenAt: new Date() } },
        )
        .exec();
      if (existing) return existing.visitorId;
    }

    const visitorId = `v_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    await this.visitorModel.create({
      siteId: siteObjectId,
      visitorId,
      lastSeenAt: new Date(),
    });
    return visitorId;
  }

  async findTenant(tenantId: string): Promise<TenantDocument | null> {
    return this.tenantModel.findOne({ tenantId }).exec();
  }

  async ensureTenant(
    tenantId: string,
    name = tenantId,
  ): Promise<TenantDocument> {
    const existing = await this.findTenant(tenantId);
    if (existing) return existing;
    return this.tenantModel.create({ tenantId, name });
  }

  newPublicToken(): string {
    return `st_${randomBytes(12).toString('base64url').slice(0, 16)}`;
  }

  private async seedDemoSite(): Promise<void> {
    const { defaultTenantId } = this.config.get('tenancy', { infer: true });
    await this.tenantContext.run(defaultTenantId, async () => {
      await this.ensureTenant(defaultTenantId, 'Demo');
      const existing = await this.findByToken('st_demo');
      if (existing) {
        if (Object.keys(existing.settings ?? {}).length === 0) {
          existing.settings = DEMO_SITE_SETTINGS;
          existing.markModified('settings');
          await existing.save();
        }
        return;
      }
      await this.siteModel.create({
        publicToken: 'st_demo',
        name: 'Demo Site',
        allowedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000'],
        status: 'active',
        settings: DEMO_SITE_SETTINGS,
      });
    });
  }
}
