import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../tenancy/members/guards/tenant-context.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { Permission } from '../../../common/constants/permissions.constants';
import { SectionsService } from './sections.service';
import { CreateSectionDto } from './dto/create-section.dto';

@ApiTags('sections')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
@Controller('organizations/:orgId/events/:eventId/sections')
export class SectionsController {
  constructor(private sectionsService: SectionsService) {}

  @RequirePermission(Permission.EVENT_EDIT)
  @Post()
  @ApiOperation({ summary: 'Add a section to an event' })
  create(
    @Param('orgId') orgId: string,
    @Param('eventId') eventId: string,
    @Body() dto: CreateSectionDto,
  ) {
    return this.sectionsService.create(orgId, eventId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List sections for an event in order' })
  list(@Param('orgId') orgId: string, @Param('eventId') eventId: string) {
    return this.sectionsService.listForEvent(orgId, eventId);
  }

  @RequirePermission(Permission.EVENT_EDIT)
  @Patch('reorder')
  @ApiOperation({ summary: 'Reorder sections' })
  reorder(
    @Param('orgId') orgId: string,
    @Param('eventId') eventId: string,
    @Body('orderedIds') orderedIds: string[],
  ) {
    return this.sectionsService.reorder(orgId, eventId, orderedIds);
  }

  @RequirePermission(Permission.EVENT_EDIT)
  @Patch(':id')
  @ApiOperation({ summary: 'Update section content/visibility' })
  update(
    @Param('orgId') orgId: string,
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateSectionDto>,
  ) {
    // ✅ FIX: Pass `eventId` as the second argument
    return this.sectionsService.update(orgId, eventId, id, dto);
  }

  @RequirePermission(Permission.EVENT_EDIT)
  @Delete(':id')
  @ApiOperation({ summary: 'Remove a section' })
  remove(
    @Param('orgId') orgId: string,
    @Param('eventId') eventId: string,
    @Param('id') id: string,
  ) {
    // ✅ FIX: Pass `eventId` here as well if remove() accepts it
    return this.sectionsService.remove(orgId, eventId, id);
  }
}