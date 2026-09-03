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

import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

import {
  RequirePermission,
} from '../../common/decorators/require-permission.decorator';

import {
  Permission,
} from '../../common/constants/permissions.constants';

import {
  CurrentUser,
} from '../../common/decorators/current-user.decorator';

import {
  TenantContextGuard,
} from '../tenancy/members/guards/tenant-context.guard';

import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';

@ApiTags('events')
@Controller()
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
  ) {}

  // =========================================================
  // PUBLIC EVENT
  // =========================================================

  @Get('e/:slug')
  @ApiOperation({
    summary:
      'Get a published event page',
  })
  getPublished(
    @Param('slug') slug: string,
  ) {
    return this.eventsService
      .findPublishedBySlug(
        slug,
      );
  }

  // =========================================================
  // CREATE EVENT
  // =========================================================

  @ApiBearerAuth()
  @UseGuards(
    JwtAuthGuard,
    TenantContextGuard,
    PermissionsGuard,
  )
  @RequirePermission(
    Permission.EVENT_CREATE,
  )
  @Post(
    'organizations/:orgId/events',
  )
  @ApiOperation({
    summary:
      'Create a draft event',
  })
  create(
    @Param('orgId') orgId: string,

    @CurrentUser()
    user: {
      userId: string;
    },

    @Body()
    dto: CreateEventDto,
  ) {
    return this.eventsService.create(
      orgId,
      user.userId,
      dto,
    );
  }

  // =========================================================
  // LIST EVENTS
  // =========================================================

  @ApiBearerAuth()
  @UseGuards(
    JwtAuthGuard,
    TenantContextGuard,
  )
  @Get(
    'organizations/:orgId/events',
  )
  @ApiOperation({
    summary:
      'List events for an organization',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
  })
  list(
    @Param('orgId') orgId: string,

    @Query(
      'page',
      new ParseIntPipe({
        optional: true,
      }),
    )
    page?: number,

    @Query(
      'limit',
      new ParseIntPipe({
        optional: true,
      }),
    )
    limit?: number,
  ) {
    return this.eventsService
      .listForOrganization(
        orgId,
        page ?? 1,
        limit ?? 10,
      );
  }

  // =========================================================
  // EVENT PREVIEW
  // =========================================================

  @ApiBearerAuth()
  @UseGuards(
    JwtAuthGuard,
    TenantContextGuard,
  )
  @Get(
    'organizations/:orgId/events/:id/preview',
  )
  @ApiOperation({
    summary:
      'Get event preview data',
  })
  getPreview(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.eventsService
      .getEventPreview(
        id,
        orgId,
      );
  }

  // =========================================================
  // APPLY TEMPLATE
  // =========================================================

  @ApiBearerAuth()
  @UseGuards(
    JwtAuthGuard,
    TenantContextGuard,
    PermissionsGuard,
  )
  @RequirePermission(
    Permission.EVENT_EDIT,
  )
  @Post(
    'organizations/:orgId/events/:id/apply-template',
  )
  @ApiOperation({
    summary:
      'Apply a template to an event',
  })
  applyTemplate(
    @Param('orgId') orgId: string,

    @Param('id') id: string,

    @Body('templateId')
    templateId: string,
  ) {
    return this.eventsService
      .applyTemplate(
        id,
        orgId,
        templateId,
      );
  }

  // =========================================================
  // EVENT DETAIL
  // =========================================================

  @ApiBearerAuth()
  @UseGuards(
    JwtAuthGuard,
    TenantContextGuard,
  )
  @Get(
    'organizations/:orgId/events/:id',
  )
  @ApiOperation({
    summary:
      'Get event detail',
  })
  findOne(
    @Param('orgId') orgId: string,

    @Param('id') id: string,
  ) {
    return this.eventsService
      .findByIdForTenantOrThrow(
        id,
        orgId,
      );
  }

  // =========================================================
  // UPDATE
  // =========================================================

  @ApiBearerAuth()
  @UseGuards(
    JwtAuthGuard,
    TenantContextGuard,
    PermissionsGuard,
  )
  @RequirePermission(
    Permission.EVENT_EDIT,
  )
  @Patch(
    'organizations/:orgId/events/:id',
  )
  @ApiOperation({
    summary:
      'Update event fields',
  })
  update(
    @Param('orgId') orgId: string,

    @Param('id') id: string,

    @Body()
    dto: Partial<CreateEventDto>,
  ) {
    return this.eventsService.update(
      id,
      orgId,
      dto,
    );
  }

  // =========================================================
  // PUBLISH
  // =========================================================

  @ApiBearerAuth()
  @UseGuards(
    JwtAuthGuard,
    TenantContextGuard,
    PermissionsGuard,
  )
  @RequirePermission(
    Permission.EVENT_PUBLISH,
  )
  @Post(
    'organizations/:orgId/events/:id/publish',
  )
  publish(
    @Param('orgId') orgId: string,

    @Param('id') id: string,

    @CurrentUser()
    user: {
      userId: string;
    },
  ) {
    return this.eventsService
      .publish(
        id,
        orgId,
        user.userId,
      );
  }

  // =========================================================
  // ARCHIVE
  // =========================================================

  @ApiBearerAuth()
  @UseGuards(
    JwtAuthGuard,
    TenantContextGuard,
    PermissionsGuard,
  )
  @RequirePermission(
    Permission.EVENT_EDIT,
  )
  @Post(
    'organizations/:orgId/events/:id/archive',
  )
  archive(
    @Param('orgId') orgId: string,

    @Param('id') id: string,
  ) {
    return this.eventsService
      .archive(
        id,
        orgId,
      );
  }

  // =========================================================
  // DUPLICATE
  // =========================================================

  @ApiBearerAuth()
  @UseGuards(
    JwtAuthGuard,
    TenantContextGuard,
    PermissionsGuard,
  )
  @RequirePermission(
    Permission.EVENT_CREATE,
  )
  @Post(
    'organizations/:orgId/events/:id/duplicate',
  )
  duplicate(
    @Param('orgId') orgId: string,

    @Param('id') id: string,

    @CurrentUser()
    user: {
      userId: string;
    },
  ) {
    return this.eventsService
      .duplicate(
        id,
        orgId,
        user.userId,
      );
  }

  // =========================================================
  // DELETE
  // =========================================================

  @ApiBearerAuth()
  @UseGuards(
    JwtAuthGuard,
    TenantContextGuard,
    PermissionsGuard,
  )
  @RequirePermission(
    Permission.EVENT_DELETE,
  )
  @Delete(
    'organizations/:orgId/events/:id',
  )
  remove(
    @Param('orgId') orgId: string,

    @Param('id') id: string,
  ) {
    return this.eventsService.remove(
      id,
      orgId,
    );
  }

  // =========================================================
  // TOURNAMENT
  // =========================================================

  @ApiBearerAuth()
  @UseGuards(
    JwtAuthGuard,
    TenantContextGuard,
  )
  @Get(
    'organizations/:orgId/events/:id/tournament',
  )
  @ApiOperation({
    summary:
      'Get tournament for an event',
  })
  getTournament(
    @Param('orgId') orgId: string,

    @Param('id') id: string,
  ) {
    return this.eventsService
      .getTournamentForEvent(
        id,
        orgId,
      );
  }
}