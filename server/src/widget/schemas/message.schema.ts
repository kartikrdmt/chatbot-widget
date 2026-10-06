import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'messages' })
export class Message {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Conversation', index: true })
  conversationId!: Types.ObjectId;

  @Prop({ required: true, enum: ['visitor', 'assistant'] })
  sender!: 'visitor' | 'assistant';

  @Prop({ required: true })
  text!: string;

  /** Echoed from the client to allow idempotent message delivery. */
  @Prop({ index: true, sparse: true })
  clientMessageId?: string;

  @Prop({ type: [{ title: String, url: String }] })
  sources?: { title: string; url: string }[];
}

export type MessageDocument = HydratedDocument<Message>;
export const MessageSchema = SchemaFactory.createForClass(Message);
