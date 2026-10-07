import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { Types } from 'mongoose';

import { tenantPlugin } from '../../common/plugins/tenant.plugin.js';

@Schema({ timestamps: true, collection: 'conversations' })
export class Conversation {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Site', index: true })
  siteId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  visitorId!: string;
}

export type ConversationDocument = HydratedDocument<Conversation>;
export const ConversationSchema = SchemaFactory.createForClass(Conversation);
ConversationSchema.plugin(tenantPlugin);
ConversationSchema.index(
  { tenantId: 1, siteId: 1, visitorId: 1 },
  { unique: true },
);
