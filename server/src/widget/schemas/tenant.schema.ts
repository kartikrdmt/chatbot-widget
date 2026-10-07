import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

/**
 * A customer company. Platform-level, so it is NOT scoped by `tenantPlugin`: it is the thing the
 * tenant id points at. `tenantId` is the same free-form string every other collection carries.
 */
@Schema({ timestamps: true, collection: 'tenants' })
export class Tenant {
  @Prop({
    required: true,
    unique: true,
    index: true,
    trim: true,
    maxlength: 128,
  })
  tenantId!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ default: 'free' })
  plan!: string;

  /** Messages the whole tenant may receive per calendar month, across all its sites. */
  @Prop({ default: 1000 })
  monthlyMessageLimit!: number;

  @Prop({ enum: ['active', 'disabled'], default: 'active' })
  status!: 'active' | 'disabled';
}

export type TenantDocument = HydratedDocument<Tenant>;
export const TenantSchema = SchemaFactory.createForClass(Tenant);
