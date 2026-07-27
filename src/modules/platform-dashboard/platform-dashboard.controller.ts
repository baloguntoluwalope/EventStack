import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { PlatformDashboardService } from './platform-dashboard.service';

@ApiTags('platform-dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller('platform/dashboard')
export class PlatformDashboardController {
  constructor(private dashboardService: PlatformDashboardService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Platform-wide overview stats (platform admin only)' })
  getOverview() {
    return this.dashboardService.getOverview();
  }
}