import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Site, SiteSchema } from '../widget/schemas/site.schema.js';
import { WidgetModule } from '../widget/widget.module.js';
import { AdminGuard } from './admin.guard.js';
import { AdminUsageController } from './admin-usage.controller.js';
import { AdminSitesController } from './admin-sites.controller.js';
import { AdminSitesService } from './admin-sites.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Site.name, schema: SiteSchema }]),
    WidgetModule,
  ],
  controllers: [AdminSitesController, AdminUsageController],
  providers: [AdminSitesService, AdminGuard],
})
export class AdminModule {}
