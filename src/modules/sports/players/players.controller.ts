import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../tenancy/members/guards/tenant-context.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { Permission } from '../../../common/constants/permissions.constants';
import { PlayersService } from './players.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';

@ApiTags('sports-players')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantContextGuard)
@Controller('organizations/:orgId')
export class PlayersController {
  constructor(private playersService: PlayersService) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission(Permission.TOURNAMENT_MANAGE)
  @Post('teams/:teamId/players')
  @ApiOperation({ summary: 'Add a player to a team roster' })
  create(@Param('orgId') orgId: string, @Param('teamId') teamId: string, @Body() dto: CreatePlayerDto) {
    return this.playersService.create(teamId, orgId, dto);
  }

  @Get('teams/:teamId/players')
  @ApiOperation({ summary: 'List a team roster' })
  list(@Param('orgId') orgId: string, @Param('teamId') teamId: string) {
    return this.playersService.listForTeam(teamId, orgId);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(Permission.TOURNAMENT_MANAGE)
  @Patch('players/:id')
  @ApiOperation({ summary: 'Update player details' })
  update(@Param('orgId') orgId: string, @Param('id') id: string, @Body() dto: UpdatePlayerDto) {
    return this.playersService.update(id, orgId, dto);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(Permission.TOURNAMENT_MANAGE)
  @Delete('players/:id')
  @ApiOperation({ summary: 'Remove a player' })
  remove(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.playersService.remove(id, orgId);
  }
}