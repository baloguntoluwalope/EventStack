import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../../common/constants/permissions.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantContextGuard } from '../tenancy/members/guards/tenant-context.guard';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';

@ApiTags('events')
@Controller()
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get('e/:slug')
  @ApiOperation({ summary: 'Get a published event page (public)' })
  getPublished(@Param('slug') slug: string) {
    return this.eventsService.findPublishedBySlug(slug);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
  @RequirePermission(Permission.EVENT_CREATE)
  @Post('organizations/:orgId/events')
  @ApiOperation({ summary: 'Create a draft event' })
  create(
    @Param('orgId') orgId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateEventDto,
  ) {
    return this.eventsService.create(orgId, user.userId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantContextGuard)
  @Get('organizations/:orgId/events')
  @ApiOperation({ summary: 'List events for an organization' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  list(
    @Param('orgId') orgId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.eventsService.listForOrganization(orgId, page, limit);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantContextGuard)
  @Get('organizations/:orgId/events/:id')
  @ApiOperation({ summary: 'Get event detail (owner view)' })
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.eventsService.findByIdForTenantOrThrow(id, orgId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
  @RequirePermission(Permission.EVENT_EDIT)
  @Patch('organizations/:orgId/events/:id')
  @ApiOperation({ summary: 'Update event fields' })
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateEventDto>,
  ) {
    return this.eventsService.update(id, orgId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
  @RequirePermission(Permission.EVENT_PUBLISH)
  @Post('organizations/:orgId/events/:id/publish')
  @ApiOperation({ summary: 'Publish event' })
  publish(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.eventsService.publish(id, orgId, user.userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
  @RequirePermission(Permission.EVENT_EDIT)
  @Post('organizations/:orgId/events/:id/archive')
  @ApiOperation({ summary: 'Archive event' })
  archive(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.eventsService.archive(id, orgId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
  @RequirePermission(Permission.EVENT_CREATE)
  @Post('organizations/:orgId/events/:id/duplicate')
  @ApiOperation({ summary: 'Duplicate event as a new draft' })
  duplicate(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.eventsService.duplicate(id, orgId, user.userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
  @RequirePermission(Permission.EVENT_DELETE)
  @Delete('organizations/:orgId/events/:id')
  @ApiOperation({ summary: 'Delete a draft event' })
  remove(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.eventsService.remove(id, orgId);
  }
}