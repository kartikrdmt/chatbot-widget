import { randomUUID } from 'node:crypto';

import { Injectable, type OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';

import { Tenant, type TenantDocument } from './schemas/tenant.schema.js';
import { Site, type SiteDocument } from './schemas/site.schema.js';
import { Visitor, type VisitorDocument } from './schemas/visitor.schema.js';

const normalizeOrigin = (origin: string): string => origin.trim().toLowerCase();

/**
 * Provides site lookup and visitor management backed by MongoDB.
 * Replaces the env-var-only WidgetSitesService.
 *
 * In development / test it seeds a demo site on startup so the widget
 * works without manual DB setup.
 */
@Injectable()
export class SiteService implements OnModuleInit {
  constructor(
    @InjectModel(Site.name) private readonly siteModel: Model<SiteDocument>,
    @InjectModel(Tenant.name) private readonly tenantModel: Model<TenantDocument>,
    @InjectModel(Visitor.name) private readonly visitorModel: Model<VisitorDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    const env = process.env.NODE_ENV ?? 'development';
    if (env === 'development' || env === 'test') {
      await this.seedDemoSite();
    }
  }

  async findByToken(token: string): Promise<SiteDocument | null> {
    return this.siteModel.findOne({ publicToken: token }).exec();
  }

  async findById(id: string): Promise<SiteDocument | null> {
    return this.siteModel.findById(id).exec();
  }

  isOriginAllowed(site: SiteDocument, origin: string): boolean {
    const candidate = normalizeOrigin(origin);
    return site.allowedOrigins.some((o) => normalizeOrigin(o) === candidate);
  }

  /** All origins across every site — used to build the server-wide CORS allow-list. */
  async allOrigins(): Promise<string[]> {
    const sites = await this.siteModel
      .find({}, { allowedOrigins: 1 })
      .lean()
      .exec();
    return sites.flatMap((s) => s.allowedOrigins);
  }

  /**
   * Creates a new visitor record and returns its public visitorId.
   * The visitorId is stored on the client and sent back on subsequent sessions.
   */
  async createVisitor(tenantId: string, siteId: string): Promise<string> {
    const visitorId = `v_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    await this.visitorModel.create({
      tenantId: new Types.ObjectId(tenantId),
      siteId: new Types.ObjectId(siteId),
      visitorId,
      lastSeenAt: new Date(),
    });
    return visitorId;
  }

  async touchVisitor(visitorId: string): Promise<void> {
    await this.visitorModel
      .updateOne({ visitorId }, { $set: { lastSeenAt: new Date() } })
      .exec();
  }

  // ---------------------------------------------------------------------------
  // Dev seed
  // ---------------------------------------------------------------------------

  private async seedDemoSite(): Promise<void> {
    const existing = await this.siteModel
      .findOne({ publicToken: 'st_demo' })
      .exec();
    if (existing) return;

    let tenant = await this.tenantModel.findOne({ name: 'Demo' }).exec();
    if (!tenant) {
      tenant = await this.tenantModel.create({ name: 'Demo' });
    }

    await this.siteModel.create({
      tenantId: tenant._id,
      publicToken: 'st_demo',
      name: 'Demo Site',
      allowedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000'],
      status: 'active',
      settings: {},
    });
  }
}
