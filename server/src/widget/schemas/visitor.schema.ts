import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'visitors' })
export class Visitor {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Tenant' })
  tenantId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Site', index: true })
  siteId!: Types.ObjectId;

  /** Publicly visible UUID assigned to this visitor. */
  @Prop({ required: true, unique: true, index: true })
  visitorId!: string;

  @Prop()
  lastSeenAt?: Date;
}

export type VisitorDocument = HydratedDocument<Visitor>;
export const VisitorSchema = SchemaFactory.createForClass(Visitor);
