import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';

import { ConversationService } from './conversation.service.js';
import { GeminiService } from './gemini.service.js';
import { RagService } from './rag.service.js';
import { RateLimitService } from './rate-limit.service.js';
import {
  Conversation,
  ConversationSchema,
} from './schemas/conversation.schema.js';
import { Message, MessageSchema } from './schemas/message.schema.js';
import { Site, SiteSchema } from './schemas/site.schema.js';
import { Tenant, TenantSchema } from './schemas/tenant.schema.js';
import { Visitor, VisitorSchema } from './schemas/visitor.schema.js';
import { SessionService } from './session.service.js';
import { SiteService } from './site.service.js';
import { WidgetController } from './widget.controller.js';
import { WidgetGateway } from './widget.gateway.js';
import { WidgetService } from './widget.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tenant.name, schema: TenantSchema },
      { name: Site.name, schema: SiteSchema },
      { name: Visitor.name, schema: VisitorSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [WidgetController],
  providers: [
    GeminiService,
    RagService,
    RateLimitService,
    SiteService,
    SessionService,
    ConversationService,
    WidgetService,
    WidgetGateway,
  ],
  exports: [SiteService],
})
export class WidgetModule {}
