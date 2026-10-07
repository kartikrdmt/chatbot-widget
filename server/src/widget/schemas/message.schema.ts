import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { Types } from 'mongoose';

import { tenantPlugin } from '../../common/plugins/tenant.plugin.js';

@Schema({ timestamps: true, collection: 'messages' })
export class Message {
  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: 'Conversation',
    index: true,
  })
  conversationId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Site', index: true })
  siteId!: Types.ObjectId;

  @Prop({ required: true, enum: ['visitor', 'assistant'] })
  sender!: 'visitor' | 'assistant';

  @Prop({ required: true })
  text!: string;

  @Prop({ index: true, sparse: true })
  clientMessageId?: string;

  @Prop({ type: [{ title: String, url: String }] })
  sources?: { title: string; url: string }[];
}

export type MessageDocument = HydratedDocument<Message>;
export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.plugin(tenantPlugin);
MessageSchema.index({ tenantId: 1, conversationId: 1, createdAt: 1 });
