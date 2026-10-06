import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { Types } from 'mongoose';

/**
 * All per-site bot and UI settings. Stored as a flexible object so new
 * settings can be added without schema migrations.
 */
export interface SiteSettings {
  systemPrompt?: string;
  llmModel?: string;
  theme?: Record<string, unknown>;
  copy?: Record<string, unknown>;
  launcher?: Record<string, unknown>;
  features?: Record<string, unknown>;
  /** Max visitor messages per minute; defaults to RATE_LIMIT_DEFAULT_MAX. */
  messagesPerMinute?: number;
  /** Max visitor messages per day; unlimited when omitted. */
  messagesPerDay?: number;
}

@Schema({ timestamps: true, collection: 'sites' })
export class Site {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Tenant' })
  tenantId!: Types.ObjectId;

  /** Public-facing token sent by the embed script (st_…). */
  @Prop({ required: true, unique: true, index: true })
  publicToken!: string;

  @Prop({ required: true })
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
