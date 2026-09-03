import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantContextGuard } from '../tenancy/members/guards/tenant-context.guard';

import { WebsiteBuilderService } from './website-builder.service';

@ApiTags('website-builder')
@Controller()
export class WebsiteBuilderController {
  constructor(
    private readonly websiteBuilderService: WebsiteBuilderService,
  ) {}

  // =========================================================
  // PUBLIC WEBSITE RENDER
  // =========================================================

  /**
   * IMPORTANT:
   *
   * Do NOT use:
   *
   *   GET /e/:slug
   *
   * here because another public event controller already
   * owns that route and returns the raw Event document.
   *
   * The website renderer therefore has an explicit /render
   * suffix.
   */

  @Get('e/:slug/render')
  @ApiOperation({
    summary:
      'Render published event website home page',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description:
      'Optional subpage slug',
  })
  async getPublished(
    @Param('slug') slug: string,
    @Query('page') pageSlug?: string,
  ) {
    return this.websiteBuilderService.renderPublishedPage(
      slug,
      pageSlug,
    );
  }

  // =========================================================
  // PUBLIC WEBSITE SUBPAGE
  // =========================================================

  @Get('e/:slug/render/:pageSlug')
  @ApiOperation({
    summary:
      'Render published event website subpage',
  })
  async getPublishedPage(
    @Param('slug') slug: string,
    @Param('pageSlug') pageSlug: string,
  ) {
    return this.websiteBuilderService.renderPublishedPage(
      slug,
      pageSlug,
    );
  }

  // =========================================================
  // OWNER PREVIEW
  // =========================================================

  @ApiBearerAuth()
  @UseGuards(
    JwtAuthGuard,
    TenantContextGuard,
  )
  @Get(
    'organizations/:orgId/events/:eventId/preview',
  )
  @ApiOperation({
    summary:
      'Owner preview render',
  })
  @ApiQuery({
    name: 'pageId',
    required: false,
    description:
      'Target page ID for preview',
  })
  async renderPreview(
    @Param('orgId') orgId: string,
    @Param('eventId') eventId: string,
    @Query('pageId') pageId?: string,
  ) {
    return this.websiteBuilderService.renderPreview(
      orgId,
      eventId,
      pageId,
    );
  }

  // =========================================================
  // UNPUBLISH
  // =========================================================

  @ApiBearerAuth()
  @UseGuards(
    JwtAuthGuard,
    TenantContextGuard,
  )
  @Post(
    'organizations/:orgId/events/:eventId/unpublish',
  )
  @ApiOperation({
    summary:
      'Unpublish event back to draft mode',
  })
  async unpublish(
    @Param('orgId') orgId: string,
    @Param('eventId') eventId: string,
  ) {
    return this.websiteBuilderService.unpublishEvent(
      orgId,
      eventId,
    );
  }
}