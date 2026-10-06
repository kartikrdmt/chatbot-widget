import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';

import {
  Conversation,
  type ConversationDocument,
} from './schemas/conversation.schema.js';
import { Message, type MessageDocument } from './schemas/message.schema.js';

@Injectable()
export class ConversationService {
  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
  ) {}

  async findOrCreate(
    tenantId: string,
    siteId: string,
    visitorId: string,
  ): Promise<ConversationDocument> {
    const existing = await this.conversationModel
      .findOne({ visitorId, siteId: new Types.ObjectId(siteId) })
      .exec();
    if (existing) return existing;

    return this.conversationModel.create({
      tenantId: new Types.ObjectId(tenantId),
      siteId: new Types.ObjectId(siteId),
      visitorId,
    });
  }

  async getHistory(
    conversationId: Types.ObjectId,
    limit = 20,
  ): Promise<MessageDocument[]> {
    const messages = await this.messageModel
      .find({ conversationId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();
    return messages.reverse() as unknown as MessageDocument[];
  }

  async saveMessage(
    conversationId: Types.ObjectId,
    sender: 'visitor' | 'assistant',
    text: string,
    clientMessageId?: string,
    sources?: { title: string; url: string }[],
  ): Promise<MessageDocument> {
    return this.messageModel.create({
      conversationId,
      sender,
      text,
      ...(clientMessageId ? { clientMessageId } : {}),
      ...(sources?.length ? { sources } : {}),
    });
  }

  /** Returns true if a message with this clientMessageId already exists (dedup guard). */
  async isDuplicate(
    conversationId: Types.ObjectId,
    clientMessageId: string,
  ): Promise<boolean> {
    const existing = await this.messageModel
      .findOne({ conversationId, clientMessageId })
      .lean()
      .exec();
    return existing !== null;
  }
}
