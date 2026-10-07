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

/**
 * What the admin panel calls. The tenant comes from the `x-tenant-id` header, exactly like the rest
 * of the API, so every query here is already scoped to it by `tenantPlugin`.
 */
@UseGuards(AdminGuard)
@Controller('admin/sites')
export class AdminSitesController {
  constructor(private readonly sites: AdminSitesService) {}

  /** Creates a site. The response carries the secret key once; only its hash is kept. */
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

  /** Name, allowed websites, or the on/off switch. */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateSiteRequestSchema))
    body: UpdateSiteRequest,
  ): Promise<Site> {
    return this.sites.update(id, body);
  }

  /** Change some settings; whatever is not sent keeps its value. */
  @Patch(':id/settings')
  patchSettings(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SiteSettingsInputSchema))
    body: SiteSettingsInput,
  ): Promise<Site> {
    return this.sites.saveSettings(id, body, true);
  }

  /** Replace all settings with exactly what is sent. */
  @Put(':id/settings')
  replaceSettings(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SiteSettingsInputSchema))
    body: SiteSettingsInput,
  ): Promise<Site> {
    return this.sites.saveSettings(id, body, false);
  }

  /** New secret key, shown once. The previous one stops working. */
  @Post(':id/rotate-secret')
  @HttpCode(200)
  rotateSecret(@Param('id') id: string): Promise<CreateSiteResponse> {
    return this.sites.rotateSecret(id);
  }
}
