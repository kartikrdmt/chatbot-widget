import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { WidgetModule } from './widget/widget.module.js';

@Module({
  imports: [WidgetModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
