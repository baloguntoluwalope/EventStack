import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../tenancy/members/guards/tenant-context.guard';
import { StandingsService } from './standings.service';

@ApiTags('sports-standings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantContextGuard)
@Controller('organizations/:orgId/tournaments/:tournamentId/standings')
export class StandingsController {
  constructor(private standingsService: StandingsService) {}

  @Get()
  @ApiOperation({ summary: 'Calculate standings (tournament-wide, or scoped to a group)' })
  @ApiQuery({ name: 'groupId', required: false })
  calculate(@Param('orgId') orgId: string, @Param('tournamentId') tournamentId: string, @Query('groupId') groupId?: string) {
    return this.standingsService.calculate(tournamentId, orgId, groupId);
  }
}