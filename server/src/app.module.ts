import {
  Logger,
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { resolve } from 'node:path';
import type { Connection } from 'mongoose';

import { AdminModule } from './admin/admin.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { TenantGuard } from './common/guards/tenant.guard.js';
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware.js';
import { TenancyModule } from './common/tenancy.module.js';
import { type AppConfig, configuration } from './config/configuration.js';
import { WidgetModule } from './widget/widget.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [resolve(process.cwd(), '.env')],
      load: [configuration],
    }),

    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const mongo = config.get('mongodb', { infer: true });
        return {
          uri: mongo.uri,
          ...(mongo.dbName ? { dbName: mongo.dbName } : {}),
          serverSelectionTimeoutMS: mongo.serverSelectionTimeoutMs,
          connectionFactory: (connection: Connection) => {
            const logger = new Logger('Mongoose');
            connection.on('error', (error: Error) =>
              logger.warn(`MongoDB unavailable: ${error.message}`),
            );
            connection.on('connected', () => logger.log('MongoDB connected'));
            connection.on('disconnected', () =>
              logger.warn('MongoDB disconnected'),
            );
            return connection;
          },
        };
      },
    }),

    TenancyModule,
    WidgetModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: TenantGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Must cover every route: the async context has to exist before any database call.
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
