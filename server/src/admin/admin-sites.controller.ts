import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  CreateSiteRequestSchema,
  type CreateSiteRequest,
  type CreateSiteResponse,
  type Site,
  SiteSettingsInputSchema,
  type SiteSettingsInput,
  UpdateSiteRequestSchema,
  type UpdateSiteRequest,
} from '@myra/contracts';

import { AdminGuard } from './admin.guard.js';
import { AdminSitesService } from './admin-sites.service.js';
import { ZodValidationPipe } from './zod-validation.pipe.js';

@UseGuards(AdminGuard)
@Controller('admin/sites')
export class AdminSitesController {
  constructor(private readonly sites: AdminSitesService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(CreateSiteRequestSchema))
    body: CreateSiteRequest,
  ): Promise<CreateSiteResponse> {
    return this.sites.create(body);
  }

  @Get()
  list(): Promise<Site[]> {
    return this.sites.list();
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<Site> {
    return this.sites.get(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateSiteRequestSchema))
    body: UpdateSiteRequest,
  ): Promise<Site> {
    return this.sites.update(id, body);
  }

  @Patch(':id/settings')
  patchSettings(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SiteSettingsInputSchema))
    body: SiteSettingsInput,
  ): Promise<Site> {
    return this.sites.saveSettings(id, body, true);
  }

  @Put(':id/settings')
  replaceSettings(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SiteSettingsInputSchema))
    body: SiteSettingsInput,
  ): Promise<Site> {
    return this.sites.saveSettings(id, body, false);
  }

  @Post(':id/rotate-secret')
  @HttpCode(200)
  rotateSecret(@Param('id') id: string): Promise<CreateSiteResponse> {
    return this.sites.rotateSecret(id);
  }
}
