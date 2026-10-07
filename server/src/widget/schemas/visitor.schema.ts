import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { Types } from 'mongoose';

import { tenantPlugin } from '../../common/plugins/tenant.plugin.js';

@Schema({ timestamps: true, collection: 'visitors' })
export class Visitor {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Site', index: true })
  siteId!: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  visitorId!: string;

  @Prop()
  lastSeenAt?: Date;
}

export type VisitorDocument = HydratedDocument<Visitor>;
export const VisitorSchema = SchemaFactory.createForClass(Visitor);
VisitorSchema.plugin(tenantPlugin);
VisitorSchema.index({ tenantId: 1, siteId: 1, visitorId: 1 });
