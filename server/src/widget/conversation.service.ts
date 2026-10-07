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
      // Two first messages can race: the unique index lets one create it and the other read it.
      const winner = await this.conversationModel
        .findOne({ visitorId, siteId: siteObjectId })
        .exec();
      if (winner) return winner;
      throw error;
    }
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
