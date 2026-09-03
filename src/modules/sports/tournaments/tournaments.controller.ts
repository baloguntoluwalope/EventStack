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

import { TournamentsService } from './tournaments.service';

import { CreateTournamentDto } from './dto/create-tournament.dto';

import { UpdateTournamentDto } from './dto/update-tournament.dto';

/**
 * =========================================================
 * AUTHENTICATED TOURNAMENT CONTROLLER
 * =========================================================
 *
 * These endpoints belong to the organization/dashboard side
 * of EventStack.
 *
 * JWT + tenant context are required.
 *
 * Public visitors should NEVER use these routes.
 */
@ApiTags('sports-tournaments')
@ApiBearerAuth()
@UseGuards(
  JwtAuthGuard,
  TenantContextGuard,
)
@Controller('organizations/:orgId')
export class TournamentsController {
  constructor(
    private readonly tournamentsService: TournamentsService,
  ) {}

  // =========================================================
  // CREATE
  // =========================================================

  @UseGuards(PermissionsGuard)
  @RequirePermission(
    Permission.TOURNAMENT_MANAGE,
  )
  @Post('events/:eventId/tournaments')
  @ApiOperation({
    summary:
      'Create a tournament under an event',
  })
  create(
    @Param('orgId') orgId: string,
    @Param('eventId') eventId: string,
    @Body() dto: CreateTournamentDto,
  ) {
    return this.tournamentsService.create(
      orgId,
      eventId,
      dto,
    );
  }

  // =========================================================
  // LIST TOURNAMENTS FOR EVENT
  // =========================================================

  @Get(
    'events/:eventId/tournaments',
  )
  @ApiOperation({
    summary:
      'List tournaments for an event',
  })
  listForEvent(
    @Param('orgId') orgId: string,
    @Param('eventId') eventId: string,
  ) {
    return this.tournamentsService.listForEvent(
      eventId,
      orgId,
    );
  }

  // =========================================================
  // GET PRIMARY TOURNAMENT
  // =========================================================

  @Get(
    'events/:eventId/tournament',
  )
  @ApiOperation({
    summary:
      'Get primary tournament associated with an event',
  })
  findOneByEvent(
    @Param('orgId') orgId: string,
    @Param('eventId') eventId: string,
  ) {
    return this.tournamentsService.findOneByEventOrThrow(
      eventId,
      orgId,
    );
  }

  // =========================================================
  // GET TOURNAMENT BY ID
  // =========================================================

  @Get('tournaments/:id')
  @ApiOperation({
    summary:
      'Get tournament detail',
  })
  findOne(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.tournamentsService.findByIdOrThrow(
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
  @Patch('tournaments/:id')
  @ApiOperation({
    summary:
      'Update tournament configuration/status',
  })
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTournamentDto,
  ) {
    return this.tournamentsService.update(
      id,
      orgId,
      dto,
    );
  }

  // =========================================================
  // PUBLISH
  // =========================================================

  @UseGuards(PermissionsGuard)
  @RequirePermission(
    Permission.TOURNAMENT_MANAGE,
  )
  @Patch('tournaments/:id/publish')
  @ApiOperation({
    summary:
      'Publish tournament',
  })
  publish(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.tournamentsService.publish(
      id,
      orgId,
    );
  }

  // =========================================================
  // UNPUBLISH
  // =========================================================

  @UseGuards(PermissionsGuard)
  @RequirePermission(
    Permission.TOURNAMENT_MANAGE,
  )
  @Patch('tournaments/:id/unpublish')
  @ApiOperation({
    summary:
      'Unpublish tournament',
  })
  unpublish(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.tournamentsService.unpublish(
      id,
      orgId,
    );
  }
}



  // =========================================================
// PUBLIC TOURNAMENT CONTROLLER
// SAME FILE — NO AUTH GUARDS
// =========================================================

@ApiTags('public-sports-tournaments')
@Controller('events')
export class PublicTournamentsController {
  constructor(
    private readonly tournamentsService: TournamentsService,
  ) {}

  @Get(':eventId/tournaments')
  @ApiOperation({
    summary: 'Get published tournaments for an event',
  })
  listForEvent(
    @Param('eventId') eventId: string,
  ) {
    return this.tournamentsService.listPublicForEvent(
      eventId,
    );
  }
}
