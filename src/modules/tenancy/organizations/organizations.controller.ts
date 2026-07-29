import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/constants/roles.constants';
import { TenantContextGuard } from '../members/guards/tenant-context.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { OrganizationsService } from './organizations.service';
import { MembersService } from '../members/members.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';

@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(
    private orgService: OrganizationsService,
    private membersService: MembersService,
  ) {}

 @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: 'Create a new organization (creator becomes Owner)' })
  async create(@CurrentUser() user: { userId: string }, @Body() dto: CreateOrganizationDto) {
    const org = await this.orgService.create(dto);
    const membership = await this.membersService.createOwnerMembership(org.id, user.userId);
    console.log('[OrganizationsController] Created membership:', JSON.stringify(membership));
    return org;
  }
  @UseGuards(JwtAuthGuard, TenantContextGuard)
  @Get(':orgId')
  @ApiOperation({ summary: 'Get organization details (any member)' })
  findOne(@Param('orgId') orgId: string) {
    return this.orgService.findByIdOrThrow(orgId);
  }

  @UseGuards(JwtAuthGuard, TenantContextGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @Patch(':orgId')
  @ApiOperation({ summary: 'Update organization branding/settings (Admin+)' })
  update(@Param('orgId') orgId: string, @Body() dto: Partial<CreateOrganizationDto>) {
    return this.orgService.update(orgId, dto);
  }

  @UseGuards(JwtAuthGuard, TenantContextGuard, RolesGuard)
  @Roles(Role.OWNER)
  @Delete(':orgId')
  @ApiOperation({ summary: 'Delete organization (Owner only)' })
  remove(@Param('orgId') orgId: string) {
    return this.orgService.delete(orgId);
  }
}