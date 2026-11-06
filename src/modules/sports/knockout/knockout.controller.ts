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
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../tenancy/members/guards/tenant-context.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { Permission } from '../../../common/constants/permissions.constants';

import { KnockoutService } from './knockout.service';
import { CreateKnockoutBracketDto } from './dto/create-knockout-bracket.dto';
import { GenerateBracketDto } from './dto/generate-bracket.dto';

@ApiTags('sports-knockout')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantContextGuard)
@Controller('organizations/:orgId/tournaments/:tournamentId/knockout')
export class KnockoutController {
  constructor(private readonly knockoutService: KnockoutService) {}

  // =========================================================
  // CREATE MANUAL BRACKET
  // =========================================================

  @Post('bracket')
  @UseGuards(PermissionsGuard)
  @RequirePermission(Permission.TOURNAMENT_MANAGE)
  @ApiOperation({
    summary: 'Define the knockout bracket structure manually',
    description:
      'Create every knockout match yourself, including how winners (and losers) feed into later matches.',
  })
  createBracket(
    @Param('orgId') orgId: string,
    @Param('tournamentId') tournamentId: string,
    @Body() dto: CreateKnockoutBracketDto,
  ) {
    return this.knockoutService.createBracket(tournamentId, orgId, dto);
  }

  // =========================================================
  // LIST BRACKET
  // =========================================================

  @Get()
  @ApiOperation({ summary: 'Get the current knockout bracket state' })
  list(
    @Param('orgId') orgId: string,
    @Param('tournamentId') tournamentId: string,
  ) {
    return this.knockoutService.listForTournament(tournamentId, orgId);
  }

  // =========================================================
  // GENERATE BRACKET FROM STANDINGS
  // =========================================================

  @Post('bracket/generate')
  @UseGuards(PermissionsGuard)
  @RequirePermission(Permission.TOURNAMENT_MANAGE)
  @ApiOperation({
    summary: 'Generate the knockout bracket, starting at a stage you choose',
    description:
      'Teams qualify from the official group standings (the standings engine\'s own ranking and tie-break rules). ' +
      'Pick the opening stage with `stage`. Qualifying teams = (teamsPerGroup x groups) + additionalBestTeams (None = 0). ' +
      'If no qualification numbers are sent they are derived from the stage (e.g. semi_final with 2 groups = top 2 per group). ' +
      'If more teams qualify than the selected stage holds, the highest-ranked teams advance and the rest are reported as cut off. ' +
      'Knockout-only tournaments without groups must choose a stage that fits all registered teams. ' +
      'Groups with no matches played are rejected unless allowIncompleteGroups is set. ' +
      'An existing bracket is never overwritten.',
  })
  @ApiQuery({
    name: 'stage',
    required: true,
    enum: [
      'preliminary',
      'round_of_64',
      'round_of_32',
      'round_of_16',
      'quarter_final',
      'semi_final',
      'final',
    ],
    description:
      'Opening stage of the bracket. Required teams: final 2, semi_final 4, quarter_final 8, round_of_16 16, round_of_32 32, round_of_64 64. preliminary accepts any other count of 3 or more.',
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
    );
  }
}


// import {
//   Body,
//   Controller,
//   Get,
//   Param,
//   Post,
//   Query,
//   UseGuards,
// } from '@nestjs/common';
// import {
//   ApiBearerAuth,
//   ApiOperation,
//   ApiQuery,
//   ApiTags,
// } from '@nestjs/swagger';

// import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
// import { TenantContextGuard } from '../../tenancy/members/guards/tenant-context.guard';
// import { PermissionsGuard } from '../../../common/guards/permissions.guard';
// import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
// import { Permission } from '../../../common/constants/permissions.constants';

// import { KnockoutService } from './knockout.service';
// import { CreateKnockoutBracketDto } from './dto/create-knockout-bracket.dto';
// import { GenerateBracketDto } from './dto/generate-bracket.dto';

// @ApiTags('sports-knockout')
// @ApiBearerAuth()
// @UseGuards(JwtAuthGuard, TenantContextGuard)
// @Controller('organizations/:orgId/tournaments/:tournamentId/knockout')
// export class KnockoutController {
//   constructor(private readonly knockoutService: KnockoutService) {}

//   // =========================================================
//   // CREATE MANUAL BRACKET
//   // =========================================================

//   @Post('bracket')
//   @UseGuards(PermissionsGuard)
//   @RequirePermission(Permission.TOURNAMENT_MANAGE)
//   @ApiOperation({
//     summary: 'Define the knockout bracket structure manually',
//     description:
//       'Create every knockout match yourself, including how winners (and losers) feed into later matches.',
//   })
//   createBracket(
//     @Param('orgId') orgId: string,
//     @Param('tournamentId') tournamentId: string,
//     @Body() dto: CreateKnockoutBracketDto,
//   ) {
//     return this.knockoutService.createBracket(tournamentId, orgId, dto);
//   }

//   // =========================================================
//   // LIST BRACKET
//   // =========================================================

//   @Get()
//   @ApiOperation({ summary: 'Get the current knockout bracket state' })
//   list(
//     @Param('orgId') orgId: string,
//     @Param('tournamentId') tournamentId: string,
//   ) {
//     return this.knockoutService.listForTournament(tournamentId, orgId);
//   }

//   // =========================================================
//   // GENERATE BRACKET FROM STANDINGS
//   // =========================================================

//   @Post('bracket/generate')
//   @UseGuards(PermissionsGuard)
//   @RequirePermission(Permission.TOURNAMENT_MANAGE)
//   @ApiOperation({
//     summary: 'Generate the knockout bracket, starting at a stage you choose',
//     description:
//       'Pick the opening stage with `stage`. The number of qualifying teams must match it: ' +
//       '(teamsPerGroup x number of groups) + additionalBestTeams. ' +
//       'additionalBestTeams defaults to 0, meaning no extra teams. ' +
//       'Example: stage=semi_final with 2 groups and teamsPerGroup=2 gives A1 vs B2 and B1 vs A2. ' +
//       'Use stage=preliminary when the team count is not a power of two (top seeds get byes).',
//   })
//   @ApiQuery({
//     name: 'stage',
//     required: true,
//     enum: [
//       'preliminary',
//       'round_of_64',
//       'round_of_32',
//       'round_of_16',
//       'quarter_final',
//       'semi_final',
//       'final',
//     ],
//     description:
//       'Opening stage of the bracket. Required teams: final 2, semi_final 4, quarter_final 8, round_of_16 16, round_of_32 32, round_of_64 64. preliminary accepts any other count of 3 or more.',
//   })
//   generateFromStandings(
//     @Param('orgId') orgId: string,
//     @Param('tournamentId') tournamentId: string,
//     @Query('stage') stage: string,
//     @Body() dto: GenerateBracketDto,
//   ) {
//     return this.knockoutService.generateFromStandings(
//       tournamentId,
//       orgId,
//       stage,
//       dto,
//     );
//   }
// }



// import {
//   Body,
//   Controller,
//   Get,
//   Param,
//   Post,
//   Query,
//   UseGuards,
// } from '@nestjs/common';

// import {
//   ApiBearerAuth,
//   ApiOperation,
//   ApiQuery,
//   ApiTags,
// } from '@nestjs/swagger';

// import {
//   JwtAuthGuard,
// } from '../../../common/guards/jwt-auth.guard';

// import {
//   TenantContextGuard,
// } from '../../tenancy/members/guards/tenant-context.guard';

// import {
//   PermissionsGuard,
// } from '../../../common/guards/permissions.guard';

// import {
//   RequirePermission,
// } from '../../../common/decorators/require-permission.decorator';

// import {
//   Permission,
// } from '../../../common/constants/permissions.constants';

// import {
//   KnockoutService,
// } from './knockout.service';

// import {
//   CreateKnockoutBracketDto,
// } from './dto/create-knockout-bracket.dto';

// import {
//   GenerateBracketDto,
// } from './dto/generate-bracket.dto';

// @ApiTags('sports-knockout')
// @ApiBearerAuth()
// @UseGuards(
//   JwtAuthGuard,
//   TenantContextGuard,
// )
// @Controller(
//   'organizations/:orgId/tournaments/:tournamentId/knockout',
// )
// export class KnockoutController {
//   constructor(
//     private readonly knockoutService: KnockoutService,
//   ) {}

//   // =========================================================
//   // CREATE MANUAL BRACKET
//   // =========================================================

//   @Post('bracket')
//   @UseGuards(PermissionsGuard)
//   @RequirePermission(
//     Permission.TOURNAMENT_MANAGE,
//   )
//   @ApiOperation({
//     summary:
//       'Define the knockout bracket structure',
//   })
//   createBracket(
//     @Param('orgId')
//     orgId: string,

//     @Param('tournamentId')
//     tournamentId: string,

//     @Body()
//     dto: CreateKnockoutBracketDto,
//   ) {
//     return this.knockoutService.createBracket(
//       tournamentId,
//       orgId,
//       dto,
//     );
//   }

//   // =========================================================
//   // LIST BRACKET
//   // =========================================================

//   @Get()
//   @ApiOperation({
//     summary:
//       'Get the current knockout bracket state',
//   })
//   list(
//     @Param('orgId')
//     orgId: string,

//     @Param('tournamentId')
//     tournamentId: string,
//   ) {
//     return this.knockoutService.listForTournament(
//       tournamentId,
//       orgId,
//     );
//   }

//   // =========================================================
//   // GENERATE BRACKET FROM STANDINGS
//   // =========================================================

//   @Post('bracket/generate')
//   @UseGuards(PermissionsGuard)
//   @RequirePermission(
//     Permission.TOURNAMENT_MANAGE,
//   )
//   @ApiOperation({
//     summary:
//       'Generate knockout bracket from group standings',
//   })
//   @ApiQuery({
//     name: 'stage',
//     required: false,
//     enum: [
//       'preliminary',
//       'round_of_64',
//       'round_of_32',
//       'round_of_16',
//       'quarter_final',
//       'semi_final',
//       'final',
//     ],
//     description:
//       'Optional expected opening stage. If omitted, the stage is inferred from the number of qualifiers. A supplied stage must match that count.',
//   })
//   generateFromStandings(
//     @Param('orgId')
//     orgId: string,

//     @Param('tournamentId')
//     tournamentId: string,

//     @Query('stage')
//     stage: string,

//     @Body()
//     dto: GenerateBracketDto,
//   ) {
//     return this.knockoutService.generateFromStandings(
//       tournamentId,
//       orgId,
//       stage,
//       dto,
//     );
//   }
// }