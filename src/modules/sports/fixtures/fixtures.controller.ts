import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
  FixturesService,
} from './fixtures.service';

import {
  CreateFixtureDto,
} from './dto/create-fixture.dto';

@ApiTags('sports-fixtures')
@ApiBearerAuth()
@UseGuards(
  JwtAuthGuard,
  TenantContextGuard,
)
@Controller(
  'organizations/:orgId',
)
export class FixturesController {
  constructor(
    private readonly fixturesService: FixturesService,
  ) {}

  // =========================================================
  // CREATE
  // =========================================================

  @UseGuards(PermissionsGuard)
  @RequirePermission(
    Permission.TOURNAMENT_MANAGE,
  )
  @Post(
    'tournaments/:tournamentId/fixtures',
  )
  @ApiOperation({
    summary: 'Create a fixture',
  })
  create(
    @Param('orgId') orgId: string,
    @Param('tournamentId')
    tournamentId: string,
    @Body() dto: CreateFixtureDto,
  ) {
    return this.fixturesService.create(
      tournamentId,
      orgId,
      dto,
    );
  }

  // =========================================================
  // LIST
  // =========================================================

  @Get(
    'tournaments/:tournamentId/fixtures',
  )
  @ApiOperation({
    summary:
      'List fixtures for a tournament',
  })
  @ApiQuery({
    name: 'groupId',
    required: false,
  })
  @ApiQuery({
    name: 'stage',
    required: false,
  })
  @ApiQuery({
    name: 'fromDate',
    required: false,
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
  })
  list(
    @Param('orgId') orgId: string,
    @Param('tournamentId')
    tournamentId: string,

    @Query('groupId')
    groupId?: string,

    @Query('stage')
    stage?: string,

    @Query('fromDate')
    fromDate?: string,

    @Query('toDate')
    toDate?: string,
  ) {
    return this.fixturesService.listForTournament(
      tournamentId,
      orgId,
      {
        groupId,
        stage,

        fromDate:
          fromDate
            ? new Date(
                fromDate,
              )
            : undefined,

        toDate:
          toDate
            ? new Date(
                toDate,
              )
            : undefined,
      },
    );
  }

  // =========================================================
  // GET ONE
  // =========================================================

  @Get('fixtures/:id')
  @ApiOperation({
    summary:
      'Get fixture detail',
  })
  findOne(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.fixturesService.findByIdOrThrow(
      id,
      orgId,
    );
  }

  // =========================================================
  // UPDATE
  // =========================================================

  @UseGuards(PermissionsGuard)
  @RequirePermission(
    Permission.TOURNAMENT_MANAGE,
  )
  @Patch('fixtures/:id')
  @ApiOperation({
    summary:
      'Update fixture',
  })
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body()
    dto: Partial<CreateFixtureDto>,
  ) {
    return this.fixturesService.update(
      id,
      orgId,
      dto,
    );
  }

  // =========================================================
  // POSTPONE
  // =========================================================

  @UseGuards(PermissionsGuard)
  @RequirePermission(
    Permission.TOURNAMENT_MANAGE,
  )
  @Post(
    'fixtures/:id/postpone',
  )
  @ApiOperation({
    summary:
      'Postpone a fixture',
  })
  postpone(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.fixturesService.postpone(
      id,
      orgId,
    );
  }

  // =========================================================
  // CANCEL
  // =========================================================

  @UseGuards(PermissionsGuard)
  @RequirePermission(
    Permission.TOURNAMENT_MANAGE,
  )
  @Post(
    'fixtures/:id/cancel',
  )
  @ApiOperation({
    summary:
      'Cancel a fixture',
  })
  cancel(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.fixturesService.cancel(
      id,
      orgId,
    );
  }
}