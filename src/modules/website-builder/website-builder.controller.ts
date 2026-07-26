import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantContextGuard } from '../tenancy/members/guards/tenant-context.guard';
import { WebsiteBuilderService } from './website-builder.service';

@ApiTags('website-builder')
@Controller()
export class WebsiteBuilderController {
  constructor(private websiteBuilderService: WebsiteBuilderService) {}

  @Get('e/:slug/render')
  @ApiOperation({ summary: 'Full render payload for a published event page (public)' })
  renderPublished(@Param('slug') slug: string) {
    return this.websiteBuilderService.renderPublishedPage(slug);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantContextGuard)
  @Get('organizations/:orgId/events/:eventId/preview')
  @ApiOperation({ summary: 'Owner preview render (works on drafts, shows hidden sections)' })
  renderPreview(@Param('orgId') orgId: string, @Param('eventId') eventId: string) {
    return this.websiteBuilderService.renderPreview(orgId, eventId);
  }
}