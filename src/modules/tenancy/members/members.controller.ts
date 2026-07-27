import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { MembersService } from './members.service';
import { InviteMemberDto } from './dto/invite-member.dto';

@ApiTags('members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class MembersController {
  constructor(private membersService: MembersService) {}

  @Get('users/me/memberships')
  @ApiOperation({ summary: 'List organizations the current user belongs to (accepted memberships only)' })
  getMyMemberships(@CurrentUser() user: { userId: string }) {
    return this.membersService.findForUser(user.userId);
  }

  @Post('organizations/:orgId/invitations')
  @ApiOperation({ summary: 'Invite a user to the organization by email' })
  invite(
    @Param('orgId') orgId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: InviteMemberDto,
  ) {
    return this.membersService.invite(orgId, user.userId, dto);
  }

  @Post('invitations/:token/accept')
  @ApiOperation({ summary: 'Accept an organization invitation' })
  accept(@Param('token') token: string, @CurrentUser() user: { userId: string }) {
    return this.membersService.acceptInvite(token, user.userId);
  }

  @Get('organizations/:orgId/members')
  @ApiOperation({ summary: 'List organization members' })
  list(@Param('orgId') orgId: string) {
    return this.membersService.list(orgId);
  }

  @Patch('organizations/:orgId/members/:membershipId')
  @ApiOperation({ summary: 'Change a member role' })
  changeRole(
    @Param('orgId') orgId: string,
    @Param('membershipId') membershipId: string,
    @Body('role') role: string,
  ) {
    return this.membersService.changeRole(orgId, membershipId, role);
  }

  @Delete('organizations/:orgId/members/:membershipId')
  @ApiOperation({ summary: 'Remove a member' })
  remove(@Param('membershipId') membershipId: string) {
    return this.membersService.remove(membershipId);
  }
}