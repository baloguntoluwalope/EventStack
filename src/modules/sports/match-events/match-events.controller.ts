import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../tenancy/members/guards/tenant-context.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { Permission } from '../../../common/constants/permissions.constants';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Audited } from '../../../common/decorators/audited.decorator';
import { MatchEventsService } from './match-events.service';
import { CreateMatchEventDto } from './dto/create-match-event.dto';

@ApiTags('sports-match-events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantContextGuard)
@Controller('organizations/:orgId')
export class MatchEventsController {
  constructor(private readonly matchEventsService: MatchEventsService) {}

  @Post('matches/:matchId/events')
  @UseGuards(PermissionsGuard)
  @RequirePermission(Permission.MATCH_EVENT_CREATE)
  @Audited('MatchEvent', 'create', ['type', 'teamId', 'playerId', 'minute'])
  @ApiOperation({
    summary:
      'Record a match event (goal, card, substitution, period marker, or correction)',
  })
  create(
    @Param('orgId') orgId: string,
    @Param('matchId') matchId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateMatchEventDto,
  ) {
    return this.matchEventsService.create(matchId, orgId, user.userId, dto);
  }

  @Get('matches/:matchId/events')
  @ApiOperation({ summary: 'Get the full event timeline for a match' })
  list(@Param('orgId') orgId: string, @Param('matchId') matchId: string) {
    return this.matchEventsService.listForMatch(matchId, orgId);
  }
}