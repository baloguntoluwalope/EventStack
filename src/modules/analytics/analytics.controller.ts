import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantContextGuard } from '../tenancy/members/guards/tenant-context.guard';
import { AnalyticsService } from './analytics.service';
import { TrackEventDto } from './dto/track-event.dto';

@ApiTags('analytics')
@Controller()
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Post('e/:slug/track')
  @ApiOperation({ summary: 'Record a page view/QR scan/click for a published event (public)' })
  track(@Body() dto: TrackEventDto) {
    return this.analyticsService.track(dto.organizationId, dto.eventId, dto.type, dto.meta);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantContextGuard)
  @Get('organizations/:orgId/events/:eventId/analytics')
  @ApiOperation({ summary: 'Analytics summary for an event' })
  getSummary(@Param('eventId') eventId: string) {
    return this.analyticsService.summary(eventId);
  }
}