import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';

import type { AppConfig } from '../config/configuration.js';
import { ANSWER_PROVIDER } from './answer/answer-provider.js';
import { EngineAnswerProvider } from './answer/engine-answer.provider.js';
import { GeminiAnswerProvider } from './answer/gemini-answer.provider.js';
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
import { UsageDaily, UsageDailySchema } from './schemas/usage-daily.schema.js';
import { Visitor, VisitorSchema } from './schemas/visitor.schema.js';
import { SessionService } from './session.service.js';
import { SiteService } from './site.service.js';
import { UsageService } from './usage.service.js';
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
      { name: UsageDaily.name, schema: UsageDailySchema },
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        secret: config.get('widget', { infer: true }).jwtSecret,
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [WidgetController],
  providers: [
    GeminiService,
    RagService,
    GeminiAnswerProvider,
    EngineAnswerProvider,
    {
      // Which provider answers: Gemini directly, or the Python engine (ANSWER_PROVIDER=engine).
      provide: ANSWER_PROVIDER,
      inject: [ConfigService, GeminiAnswerProvider, EngineAnswerProvider],
      useFactory: (
        config: ConfigService<AppConfig, true>,
        gemini: GeminiAnswerProvider,
        engine: EngineAnswerProvider,
      ) =>
        config.get('widget', { infer: true }).answerProvider === 'engine'
          ? engine
          : gemini,
    },
    UsageService,
    RateLimitService,
    SiteService,
    SessionService,
    ConversationService,
    WidgetService,
    WidgetGateway,
  ],
  exports: [SiteService, UsageService],
})
export class WidgetModule {}
