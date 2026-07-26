import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  UseGuards,
  Version,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiExcludeEndpoint } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantContextGuard } from '../tenancy/members/guards/tenant-context.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';
import { Permission } from '../../common/constants/permissions.constants';
import { SeoService } from './seo.service';
import { EventsService } from '../events/events.service';
import { UpdateEventSeoDto } from '../events/dto/update-event-seo.dto';

@ApiTags('seo')
@Controller()
export class SeoController {
  constructor(
    private seoService: SeoService,
    private eventsService: EventsService,
    private config: ConfigService,
  ) {}

  private get baseUrl(): string {
    return this.config.get<string>('appUrl') || 'http://localhost:3000';
  }

  @Get('e/:slug/seo')
  @ApiOperation({ summary: 'Meta tags + schema.org JSON-LD for a published event page (public)' })
  getSeo(@Param('slug') slug: string) {
    return this.seoService.generateForPublishedEvent(slug, this.baseUrl);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
  @RequirePermission(Permission.EVENT_EDIT)
  @Patch('organizations/:orgId/events/:id/seo')
  @ApiOperation({ summary: 'Override SEO meta title/description/OG image for an event' })
  updateSeo(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEventSeoDto,
  ) {
    return this.eventsService.updateSeoFields(id, orgId, dto);
  }

  @Version(VERSION_NEUTRAL)
  @SkipTransform()
  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml')
  @ApiExcludeEndpoint()
  async sitemap() {
    return this.seoService.generateSitemap(this.baseUrl);
  }

  @Version(VERSION_NEUTRAL)
  @SkipTransform()
  @Get('robots.txt')
  @Header('Content-Type', 'text/plain')
  @ApiExcludeEndpoint()
  robots() {
    return this.seoService.generateRobotsTxt(this.baseUrl);
  }
}