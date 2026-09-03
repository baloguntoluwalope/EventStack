import {
  Body,
  Controller,
  Delete,
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

import { TeamsService } from './teams.service';

import { CreateTeamDto } from './dto/create-team.dto';
import { RegisterTeamDto } from './dto/register-team.dto';

@ApiTags('sports-teams')
@ApiBearerAuth()
@UseGuards(
  JwtAuthGuard,
  TenantContextGuard,
)
@Controller('organizations/:orgId')
export class TeamsController {
  constructor(
    private readonly teamsService: TeamsService,
  ) {}

  // =========================================================
  // CREATE TEAM
  // =========================================================

  @UseGuards(PermissionsGuard)
  @RequirePermission(
    Permission.TOURNAMENT_MANAGE,
  )
  @Post('teams')
  @ApiOperation({
    summary:
      'Create an organization-level team',
  })
  create(
    @Param('orgId') orgId: string,
    @Body() dto: CreateTeamDto,
  ) {
    return this.teamsService.create(
      orgId,
      dto,
    );
  }

  // =========================================================
  // LIST ORGANIZATION TEAMS
  // =========================================================

  @Get('teams')
  @ApiOperation({
    summary:
      'List all organization teams',
  })
  list(
    @Param('orgId') orgId: string,
  ) {
    return this.teamsService.list(
      orgId,
    );
  }

  // =========================================================
  // GET SINGLE TEAM
  // =========================================================

  @Get('teams/:id')
  @ApiOperation({
    summary:
      'Get a single organization team',
  })
  get(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.teamsService.findByIdOrThrow(
      id,
      orgId,
    );
  }

  // =========================================================
  // UPDATE TEAM
  // =========================================================

  @UseGuards(PermissionsGuard)
  @RequirePermission(
    Permission.TOURNAMENT_MANAGE,
  )
  @Patch('teams/:id')
  @ApiOperation({
    summary:
      'Update an organization team',
  })
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() body: Record<string, any>,
  ) {
    return this.teamsService.update(
      orgId,
      id,
      body,
    );
  }

  // =========================================================
  // REGISTER TEAM FOR TOURNAMENT
  // =========================================================

  @UseGuards(PermissionsGuard)
  @RequirePermission(
    Permission.TOURNAMENT_MANAGE,
  )
  @Post(
    'tournaments/:tournamentId/teams',
  )
  @ApiOperation({
    summary:
      'Register an existing team into a tournament',
  })
  register(
    @Param('orgId') orgId: string,
    @Param('tournamentId')
    tournamentId: string,
    @Body() dto: RegisterTeamDto,
  ) {
    return this.teamsService.registerForTournament(
      orgId,
      tournamentId,
      dto,
    );
  }

  // =========================================================
  // LIST RAW TEAM REGISTRATIONS
  // =========================================================
  //
  // IMPORTANT:
  // This returns TeamRegistration documents,
  // NOT Team documents.
  //

  @Get(
    'tournaments/:tournamentId/team-registrations',
  )
  @ApiOperation({
    summary:
      'List raw team registrations for a tournament',
  })
  listTeamRegistrations(
    @Param('orgId') orgId: string,
    @Param('tournamentId')
    tournamentId: string,
  ) {
    return this.teamsService.listRegistrations(
      orgId,
      tournamentId,
    );
  }

  // =========================================================
  // LIST ACTUAL REGISTERED TEAMS
  // =========================================================

  @Get(
    'tournaments/:tournamentId/teams',
  )
  @ApiOperation({
    summary:
      'List actual teams registered in a tournament',
  })
  listTournamentTeams(
    @Param('orgId') orgId: string,
    @Param('tournamentId')
    tournamentId: string,
  ) {
    return this.teamsService.listForTournament(
      orgId,
      tournamentId,
    );
  }

  // =========================================================
  // UPDATE TEAM REGISTRATION
  // =========================================================

  @UseGuards(PermissionsGuard)
  @RequirePermission(
    Permission.TOURNAMENT_MANAGE,
  )
  @Patch(
    'tournaments/:tournamentId/teams/:registrationId',
  )
  @ApiOperation({
    summary:
      'Update a tournament team registration',
  })
  updateRegistration(
    @Param('orgId') orgId: string,
    @Param('tournamentId')
    tournamentId: string,
    @Param('registrationId')
    registrationId: string,
    @Body()
    body: {
      groupId?: string | null;
      status?: string;
    },
  ) {
    return this.teamsService.updateRegistration(
      orgId,
      tournamentId,
      registrationId,
      body,
    );
  }

  // =========================================================
  // WITHDRAW TEAM
  // =========================================================

  @UseGuards(PermissionsGuard)
  @RequirePermission(
    Permission.TOURNAMENT_MANAGE,
  )
  @Delete(
    'tournaments/:tournamentId/teams/:registrationId',
  )
  @ApiOperation({
    summary:
      'Withdraw a team from a tournament',
  })
  withdraw(
    @Param('orgId') orgId: string,
    @Param('tournamentId')
    tournamentId: string,
    @Param('registrationId')
    registrationId: string,
  ) {
    return this.teamsService.withdraw(
      orgId,
      tournamentId,
      registrationId,
    );
  }

  // =========================================================
  // DELETE ORGANIZATION TEAM
  // =========================================================

  @UseGuards(PermissionsGuard)
  @RequirePermission(
    Permission.TOURNAMENT_MANAGE,
  )
  @Delete('teams/:id')
  @ApiOperation({
    summary:
      'Soft-delete an organization team',
  })
  remove(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.teamsService.remove(
      orgId,
      id,
    );
  }
}