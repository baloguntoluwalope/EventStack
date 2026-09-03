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

import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';

@ApiTags('sports-groups')
@ApiBearerAuth()
@UseGuards(
  JwtAuthGuard,
  TenantContextGuard,
)
@Controller(
  'organizations/:orgId/tournaments/:tournamentId/groups',
)
export class GroupsController {
  constructor(
    private readonly groupsService: GroupsService,
  ) { }

  // =========================================================
  // CREATE GROUP
  // POST /organizations/:orgId/tournaments/:tournamentId/groups
  // =========================================================

  @UseGuards(PermissionsGuard)
  @RequirePermission(
    Permission.TOURNAMENT_MANAGE,
  )
  @Post()
  @ApiOperation({
    summary:
      'Create a group within a tournament',
  })
  create(
    @Param('orgId') orgId: string,
    @Param('tournamentId')
    tournamentId: string,
    @Body() dto: CreateGroupDto,
  ) {
    return this.groupsService.create(
      tournamentId,
      orgId,
      dto,
    );
  }

  // =========================================================
  // LIST GROUPS
  // GET /organizations/:orgId/tournaments/:tournamentId/groups
  // =========================================================

  @Get()
  @ApiOperation({
    summary:
      'List groups for a tournament',
  })
  list(
    @Param('orgId') orgId: string,
    @Param('tournamentId')
    tournamentId: string,
  ) {
    return this.groupsService.listForTournament(
      tournamentId,
      orgId,
    );
  }

  // =========================================================
  // GET SINGLE GROUP
  // GET .../groups/:id
  // =========================================================

  @Get(':id')
  @ApiOperation({
    summary:
      'Get a single tournament group',
  })
  get(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.groupsService.findByIdOrThrow(
      id,
      orgId,
    );
  }

  // =========================================================
  // UPDATE GROUP
  // PATCH .../groups/:id
  // =========================================================

  @UseGuards(PermissionsGuard)
  @RequirePermission(
    Permission.TOURNAMENT_MANAGE,
  )
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a group',
  })
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateGroupDto>,
  ) {
    return this.groupsService.update(
      id,
      orgId,
      dto,
    );
  }

  // =========================================================
  // DELETE GROUP
  // DELETE .../groups/:id
  // =========================================================

  @UseGuards(PermissionsGuard)
  @RequirePermission(
    Permission.TOURNAMENT_MANAGE,
  )
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a group',
  })
  remove(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.groupsService.remove(
      id,
      orgId,
    );
  }
}