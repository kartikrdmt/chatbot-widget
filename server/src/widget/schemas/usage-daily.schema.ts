import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { Types } from 'mongoose';

import { tenantPlugin } from '../../common/plugins/tenant.plugin.js';

/** How many visitor messages a site received on one UTC day. One document per site per day. */
@Schema({ timestamps: true, collection: 'usage_daily' })
export class UsageDaily {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Site' })
  siteId!: Types.ObjectId;

  /** UTC day, `YYYY-MM-DD`. */
  @Prop({ required: true })
  date!: string;

  @Prop({ default: 0 })
  messages!: number;
}

export type UsageDailyDocument = HydratedDocument<UsageDaily>;
export const UsageDailySchema = SchemaFactory.createForClass(UsageDaily);
UsageDailySchema.plugin(tenantPlugin);
UsageDailySchema.index({ tenantId: 1, siteId: 1, date: 1 }, { unique: true });
