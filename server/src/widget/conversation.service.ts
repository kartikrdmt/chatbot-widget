import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';

import {
  Conversation,
  type ConversationDocument,
} from './schemas/conversation.schema.js';
import { Message, type MessageDocument } from './schemas/message.schema.js';

/**
 * Conversations and messages. Every query here is scoped to the tenant in context by
 * `tenantPlugin`; callers run inside `TenantContextService.run(tenantId, …)`.
 */
@Injectable()
export class ConversationService {
  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
  ) {}

  /** The visitor's one conversation on this site, created on first use. */
  async findOrCreate(
    siteId: string,
    visitorId: string,
  ): Promise<ConversationDocument> {
    const siteObjectId = new Types.ObjectId(siteId);
    const existing = await this.conversationModel
      .findOne({ visitorId, siteId: siteObjectId })
      .exec();
    if (existing) return existing;

    try {
      return await this.conversationModel.create({
        siteId: siteObjectId,
        visitorId,
      });
    } catch (error) {
      // Two messages racing to create the first conversation: the unique index lets one win.
      const winner = await this.conversationModel
        .findOne({ visitorId, siteId: siteObjectId })
        .exec();
      if (winner) return winner;
      throw error;
    }
  }

  /** The most recent `limit` messages, oldest first. */
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
    conversation: Pick<ConversationDocument, '_id' | 'siteId'>,
    sender: 'visitor' | 'assistant',
    text: string,
    clientMessageId?: string,
    sources?: { title: string; url: string }[],
  ): Promise<MessageDocument> {
    return this.messageModel.create({
      conversationId: conversation._id,
      siteId: conversation.siteId,
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
