import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../tenancy/members/guards/tenant-context.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { Permission } from '../../../common/constants/permissions.constants';
import { Audited } from '../../../common/decorators/audited.decorator';

import { MatchesService } from './matches.service';
import { TransitionMatchDto } from './dto/transition-match.dto';
import { SetAddedTimeDto } from './dto/set-added-time.dto';

@ApiTags('sports-matches')
@ApiBearerAuth()
@UseGuards(
  JwtAuthGuard,
  TenantContextGuard,
)
@Controller(
  'organizations/:orgId',
)
export class MatchesController {
  constructor(
    private readonly matchesService: MatchesService,
  ) {}

  // =========================================================
  // START MATCH
  // =========================================================

  @Post(
    'fixtures/:fixtureId/matches',
  )
  @UseGuards(PermissionsGuard)
  @RequirePermission(
    Permission.TOURNAMENT_MANAGE,
  )
  @Audited(
    'Match',
    'start',
    ['status', 'startedAt'],
  )
  @ApiOperation({
    summary:
      'Start a match for a fixture',
  })
  start(
    @Param('orgId') orgId: string,
    @Param('fixtureId')
    fixtureId: string,
  ) {
    return this.matchesService.start(
      fixtureId,
      orgId,
    );
  }

  // =========================================================
  // LIST TOURNAMENT MATCHES
  // =========================================================

  @Get(
    'tournaments/:tournamentId/matches',
  )
  @ApiOperation({
    summary:
      'List matches for a tournament',
  })
  list(
    @Param('orgId') orgId: string,
    @Param('tournamentId')
    tournamentId: string,
  ) {
    return this.matchesService.listForTournament(
      tournamentId,
      orgId,
    );
  }

  // =========================================================
  // GET MATCH BY ID
  // =========================================================

  @Get('matches/:id')
  @ApiOperation({
    summary: 'Get match detail',
  })
  findOne(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.matchesService.findByIdOrThrow(
      id,
      orgId,
    );
  }

  // =========================================================
  // GET MATCH FOR FIXTURE
  // =========================================================

  @Get(
    'fixtures/:fixtureId/match',
  )
  @ApiOperation({
    summary:
      'Get the match for a fixture',
  })
  findByFixture(
    @Param('orgId') orgId: string,
    @Param('fixtureId')
    fixtureId: string,
  ) {
    return this.matchesService.findByFixtureIdOrNull(
      fixtureId,
      orgId,
    );
  }

  // =========================================================
  // TRANSITION
  // =========================================================

  @Patch(
    'matches/:id/transition',
  )
  @UseGuards(PermissionsGuard)
  @RequirePermission(
    Permission.TOURNAMENT_MANAGE,
  )
  @Audited(
    'Match',
    'transition',
    [
      'status',
      'homeScore',
      'awayScore',
    ],
  )
  @ApiOperation({
    summary:
      'Transition match state',
  })
  transition(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body()
    dto: TransitionMatchDto,
  ) {
    return this.matchesService.transition(
      id,
      orgId,
      dto.status,
    );
  }
}

@ApiTags('public-sports-matches')
@Controller('tournaments')
export class PublicMatchesController {
  constructor(
    private readonly matchesService: MatchesService,
  ) {}

  @Get(':tournamentId/matches')
  @ApiOperation({
    summary: 'Get public matches for a tournament',
  })
  listForTournament(
    @Param('tournamentId') tournamentId: string,
  ) {
    return this.matchesService.listPublicForTournament(
      tournamentId,
    );
  }

  // =========================================================
// ADDED TIME
// =========================================================

@Patch('matches/:id/added-time')
@UseGuards(PermissionsGuard)
@RequirePermission(
  Permission.TOURNAMENT_MANAGE,
)
@Audited(
  'Match',
  'set_added_time',
  ['currentAddedTime'],
)
@ApiOperation({
  summary:
    'Set added time for the current match period',
})
setAddedTime(
  @Param('orgId') orgId: string,
  @Param('id') id: string,
  @Body() dto: SetAddedTimeDto,
) {
  return this.matchesService.setAddedTime(
    id,
    orgId,
    dto.minutes,
  );
}
}