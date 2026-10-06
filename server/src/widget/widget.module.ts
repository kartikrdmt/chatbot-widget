import { Module } from '@nestjs/common';

import { GeminiService } from './gemini.service.js';
import { WidgetController } from './widget.controller.js';
import { WidgetGateway } from './widget.gateway.js';
import { WidgetService } from './widget.service.js';
import { WidgetSitesService } from './widget-sites.service.js';

@Module({
  controllers: [WidgetController],
  providers: [GeminiService, WidgetGateway, WidgetService, WidgetSitesService],
})
export class WidgetModule {}
