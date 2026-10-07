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

/**
 * Sites, tenants and visitors, backed by MongoDB.
 *
 * Two kinds of query live here, and the difference matters:
 *
 * - Anything that runs for a known tenant (a visitor, a site by id) relies on `tenantPlugin` to
 *   scope it. Callers run inside `TenantContextService.run(tenantId, …)`.
 * - Looking a site up BY ITS PUBLIC TOKEN, and listing every site's origins for CORS, cannot know
 *   the tenant yet: the token is how we find out. Those are the only deliberate
 *   `skipTenant: true` queries, so they are easy to find and review.
 */
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

  /** The one lookup that cannot be tenant-scoped: the public token is how the tenant is found. */
  async findByToken(token: string): Promise<SiteDocument | null> {
    return this.siteModel
      .findOne({ publicToken: token })
      .setOptions({ skipTenant: true })
      .exec();
  }

  /** Scoped to the tenant in context. */
  async findById(id: string): Promise<SiteDocument | null> {
    return this.siteModel.findById(id).exec();
  }

  isOriginAllowed(site: SiteDocument, origin: string): boolean {
    const candidate = normalizeOrigin(origin);
    return site.allowedOrigins.some((o) => normalizeOrigin(o) === candidate);
  }

  /** Every origin across every site, for the server-wide CORS check. */
  async allOrigins(): Promise<string[]> {
    const sites = await this.siteModel
      .find({}, { allowedOrigins: 1 })
      .setOptions({ skipTenant: true })
      .lean()
      .exec();
    return sites.flatMap((s) => s.allowedOrigins);
  }

  /**
   * True when any site lists this origin. Backed by a short-lived cache, so a site added to the
   * database starts working within ORIGIN_CACHE_MS without restarting the server.
   */
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

  /** Forget the cached origins, so a just-changed site list applies immediately. */
  invalidateOriginCache(): void {
    this.originCache = null;
  }

  /**
   * The visitor for this request: the one the widget remembered if it really belongs to this site,
   * otherwise a fresh one. Runs in the tenant's context.
   */
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

  /** Platform-level lookup of a tenant's plan; tenants are not tenant-scoped. */
  async findTenant(tenantId: string): Promise<TenantDocument | null> {
    return this.tenantModel.findOne({ tenantId }).exec();
  }

  /** Creates a tenant record if it does not exist yet. */
  async ensureTenant(
    tenantId: string,
    name = tenantId,
  ): Promise<TenantDocument> {
    const existing = await this.findTenant(tenantId);
    if (existing) return existing;
    return this.tenantModel.create({ tenantId, name });
  }

  /** A new public token: `st_` plus 16 random characters. */
  newPublicToken(): string {
    return `st_${randomBytes(12).toString('base64url').slice(0, 16)}`;
  }

  /** Development only: one demo site, so the widget works with no manual database setup. */
  private async seedDemoSite(): Promise<void> {
    const { defaultTenantId } = this.config.get('tenancy', { infer: true });
    await this.tenantContext.run(defaultTenantId, async () => {
      await this.ensureTenant(defaultTenantId, 'Demo');
      const existing = await this.findByToken('st_demo');
      if (existing) {
        // A demo site created before it had settings gets them once; later edits are never touched.
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
