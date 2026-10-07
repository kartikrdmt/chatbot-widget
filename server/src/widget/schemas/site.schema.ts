import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { SiteSettingsInput } from '@myra/contracts';
import type { HydratedDocument } from 'mongoose';

import { tenantPlugin } from '../../common/plugins/tenant.plugin.js';

export type SiteSettings = SiteSettingsInput;

@Schema({ timestamps: true, collection: 'sites' })
export class Site {
  declare tenantId: string;

  @Prop({ required: true, unique: true, index: true })
  publicToken!: string;

  @Prop({ select: false })
  secretKeyHash?: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: [String], default: [] })
  allowedOrigins!: string[];

  @Prop({ enum: ['active', 'disabled'], default: 'active' })
  status!: 'active' | 'disabled';

  @Prop({ type: Object, default: {} })
  settings!: SiteSettings;
}

export type SiteDocument = HydratedDocument<Site>;
export const SiteSchema = SchemaFactory.createForClass(Site);
SiteSchema.plugin(tenantPlugin);
