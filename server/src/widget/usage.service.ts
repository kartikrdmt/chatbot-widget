import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type Model } from 'mongoose';

import {
  UsageDaily,
  type UsageDailyDocument,
} from './schemas/usage-daily.schema.js';

export interface QuotaStatus {
  allowed: boolean;
  used: number;
  limit: number;
}

export interface SiteUsage {
  siteId: string;
  messages: number;
}

const ALERT_AT = 0.8;

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);
  private readonly alerted = new Set<string>();

  constructor(
    @InjectModel(UsageDaily.name)
    private readonly usageModel: Model<UsageDailyDocument>,
  ) {}

  async recordMessage(siteId: string, now = new Date()): Promise<void> {
    await this.usageModel
      .updateOne(
        { siteId: new Types.ObjectId(siteId), date: dayOf(now) },
        { $inc: { messages: 1 } },
        { upsert: true },
      )
      .exec();
  }

  async monthlyStatus(
    tenantId: string,
    limit: number,
    now = new Date(),
  ): Promise<QuotaStatus> {
    const used = (await this.bySite(now)).reduce(
      (sum, site) => sum + site.messages,
      0,
    );

    const month = dayOf(now).slice(0, 7);
    if (
      limit > 0 &&
      used >= limit * ALERT_AT &&
      !this.alerted.has(`${tenantId}|${month}`)
    ) {
      this.alerted.add(`${tenantId}|${month}`);
      this.logger.warn(
        `Tenant "${tenantId}" has used ${used} of ${limit} messages this month (${Math.round((used / limit) * 100)}%).`,
      );
    }
    return { allowed: used < limit, used, limit };
  }

  async bySite(now = new Date()): Promise<SiteUsage[]> {
    const monthStart = `${dayOf(now).slice(0, 7)}-01`;
    const days = await this.usageModel
      .find({ date: { $gte: monthStart } })
      .lean()
      .exec();

    const totals = new Map<string, number>();
    for (const day of days) {
      const siteId = String(day.siteId);
      totals.set(siteId, (totals.get(siteId) ?? 0) + day.messages);
    }
    return [...totals].map(([siteId, messages]) => ({ siteId, messages }));
  }
}

export const dayOf = (date: Date): string => date.toISOString().slice(0, 10);
