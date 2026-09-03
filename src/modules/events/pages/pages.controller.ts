import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../tenancy/members/guards/tenant-context.guard';
import { PlatformAdminGuard } from '../../../common/guards/platform-admin.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { Permission } from '../../../common/constants/permissions.constants';
import { PagesService } from './pages.service';
import { CreatePageDto } from './dto/create-page.dto';

@ApiTags('event-pages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantContextGuard)
@Controller('organizations/:orgId/events/:eventId/pages')
export class PagesController {
  constructor(private pagesService: PagesService) {}

  @UseGuards(PlatformAdminGuard)
  @Post()
  @ApiOperation({ summary: '[Platform admin only] Add a page to an event — used for template authoring, not organizer self-service' })
  create(@Param('orgId') orgId: string, @Param('eventId') eventId: string, @Body() dto: CreatePageDto) {
    return this.pagesService.create(eventId, orgId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all pages for an event' })
  list(@Param('orgId') orgId: string, @Param('eventId') eventId: string) {
    return this.pagesService.listForEvent(eventId, orgId);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(Permission.EVENT_EDIT)
  @Patch(':id')
  @ApiOperation({ summary: 'Toggle nav visibility for an existing page (organizer-editable; structure itself is not)' })
  update(@Param('orgId') orgId: string, @Param('id') id: string, @Body() dto: { showInNav?: boolean }) {
    return this.pagesService.update(id, orgId, dto);
  }

  @UseGuards(PlatformAdminGuard)
  @Delete(':id')
  @ApiOperation({ summary: '[Platform admin only] Delete a page' })
  remove(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.pagesService.remove(id, orgId);
  }
}