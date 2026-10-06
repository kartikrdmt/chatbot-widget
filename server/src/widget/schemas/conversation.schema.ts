import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'conversations' })
export class Conversation {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Tenant' })
  tenantId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Site', index: true })
  siteId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  visitorId!: string;
}

export type ConversationDocument = HydratedDocument<Conversation>;
export const ConversationSchema = SchemaFactory.createForClass(Conversation);
