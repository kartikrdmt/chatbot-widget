import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { SiteSettingsInput } from '@myra/contracts';
import type { HydratedDocument } from 'mongoose';

import { tenantPlugin } from '../../common/plugins/tenant.plugin.js';

/**
 * All per-site bot and UI settings. Stored as one flexible object so a new setting needs no
 * migration. The shape is the `SiteSettingsInput` contract: the admin API validates against it
 * before anything is saved, and the widget config is built from it.
 */
export type SiteSettings = SiteSettingsInput;

/**
 * A website the widget is installed on. `tenantId` is added by `tenantPlugin`, not declared here,
 * so there is exactly one definition of how tenancy works across every collection.
 */
@Schema({ timestamps: true, collection: 'sites' })
export class Site {
  /** Added by `tenantPlugin`; declared only so the type is known. */
  declare tenantId: string;

  /** Public-facing token sent by the embed script (st_…). Not a secret. */
  @Prop({ required: true, unique: true, index: true })
  publicToken!: string;

  /** SHA-256 of the site's secret key. The key itself is shown once, at creation. */
  @Prop({ select: false })
  secretKeyHash?: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: [String], default: [] })
  allowedOrigins!: string[];

  /** `disabled` is the emergency switch: the widget stops appearing and chats are refused. */
  @Prop({ enum: ['active', 'disabled'], default: 'active' })
  status!: 'active' | 'disabled';

  @Prop({ type: Object, default: {} })
  settings!: SiteSettings;
}

export type SiteDocument = HydratedDocument<Site>;
export const SiteSchema = SchemaFactory.createForClass(Site);
SiteSchema.plugin(tenantPlugin);
