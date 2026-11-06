import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { Permission } from '../../../common/constants/permissions.constants';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { TenantContextGuard } from './guards/tenant-context.guard';
import { MembersService } from './members.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { ChangeRoleDto } from './dto/change-role.dto';

@ApiTags('members')
@ApiBearerAuth()
@Controller() // no class-level guard anymore: each route declares exactly what it needs
export class MembersController {
  constructor(private membersService: MembersService) {}

  @UseGuards(JwtAuthGuard) // only needs a login, since it's about yourself
  @Get('users/me/memberships')
  @ApiOperation({ summary: 'Organizations the current user belongs to' })
  getMyMemberships(@CurrentUser() user: { userId: string }) {
    return this.membersService.findForUser(user.userId);
  }

  @UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
  @RequirePermission(Permission.MEMBER_INVITE)
  @Post('organizations/:orgId/invitations')
  invite(@Param('orgId') orgId: string, @CurrentUser() user: { userId: string }, @Body() dto: InviteMemberDto) {
    return this.membersService.invite(orgId, user.userId, dto);
  }

  // No TenantContextGuard here: the invitee isn't a member yet, which is
  // the whole point. The checks live inside acceptInvite instead.
  @UseGuards(JwtAuthGuard)
  @Post('invitations/:token/accept')
  accept(@Param('token') token: string, @CurrentUser() user: { userId: string }) {
    return this.membersService.acceptInvite(token, user.userId);
  }

  // Only owners and admins see the full roster (it contains everyone's email).
  @UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
  @RequirePermission(Permission.MEMBER_INVITE)
  @Get('organizations/:orgId/members')
  list(@Param('orgId') orgId: string) {
    return this.membersService.list(orgId);
  }

  @UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
  @RequirePermission(Permission.ORGANIZATION_MANAGE)
  @Patch('organizations/:orgId/members/:membershipId')
  changeRole(@Param('orgId') orgId: string, @Param('membershipId') membershipId: string, @Body() dto: ChangeRoleDto) {
    return this.membersService.changeRole(orgId, membershipId, dto.role);
  }

  @UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
  @RequirePermission(Permission.MEMBER_REMOVE)
  @Delete('organizations/:orgId/members/:membershipId')
  remove(@Param('orgId') orgId: string, @Param('membershipId') membershipId: string) {
    return this.membersService.remove(orgId, membershipId);
  }
}