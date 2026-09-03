import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';

import {
  JwtAuthGuard,
} from '../../../common/guards/jwt-auth.guard';

import {
  TenantContextGuard,
} from '../../tenancy/members/guards/tenant-context.guard';

import {
  PermissionsGuard,
} from '../../../common/guards/permissions.guard';

import {
  RequirePermission,
} from '../../../common/decorators/require-permission.decorator';

import {
  Permission,
} from '../../../common/constants/permissions.constants';

import {
  KnockoutService,
} from './knockout.service';

import {
  GroupsService,
} from '../groups/groups.service';

import {
  StandingsService,
} from '../standings/standings.service';

import {
  CreateKnockoutBracketDto,
} from './dto/create-knockout-bracket.dto';

import {
  GenerateBracketDto,
} from './dto/generate-bracket.dto';

@ApiTags('sports-knockout')
@ApiBearerAuth()
@UseGuards(
  JwtAuthGuard,
  TenantContextGuard,
)
@Controller(
  'organizations/:orgId/tournaments/:tournamentId/knockout',
)
export class KnockoutController {
  constructor(
    private readonly knockoutService: KnockoutService,

    private readonly groupsService: GroupsService,

    private readonly standingsService: StandingsService,
  ) {}

  // =========================================================
  // CREATE MANUAL BRACKET
  // =========================================================

  @UseGuards(PermissionsGuard)
  @RequirePermission(
    Permission.TOURNAMENT_MANAGE,
  )
  @Post('bracket')
  @ApiOperation({
    summary:
      'Define the knockout bracket structure',
  })
  createBracket(
    @Param('orgId')
    orgId: string,

    @Param('tournamentId')
    tournamentId: string,

    @Body()
    dto: CreateKnockoutBracketDto,
  ) {
    return this.knockoutService.createBracket(
      tournamentId,
      orgId,
      dto,
    );
  }

  // =========================================================
  // LIST BRACKET
  // =========================================================

  @Get()
  @ApiOperation({
    summary:
      'Get the current knockout bracket state',
  })
  list(
    @Param('orgId')
    orgId: string,

    @Param('tournamentId')
    tournamentId: string,
  ) {
    return this.knockoutService.listForTournament(
      tournamentId,
      orgId,
    );
  }

  // =========================================================
  // GENERATE BRACKET
  // =========================================================

 @Post('bracket/generate')
@ApiOperation({
  summary:
    'Generate knockout bracket from group standings',
})
generateFromStandings(
  @Param('orgId') orgId: string,
  @Param('tournamentId') tournamentId: string,
  @Query('stage') stage: string,
  @Body() dto: GenerateBracketDto,
) {
  return this.knockoutService.generateFromStandings(
    tournamentId,
    orgId,
    stage,
    dto,
    this.groupsService,
    this.standingsService,
  );
}
}