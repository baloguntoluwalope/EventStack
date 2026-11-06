import {
  Controller,
  Body,
  Get,
  Param,
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

import { SectionsService } from './sections.service';
import { TemplatesService } from '../../events/templates/templates.service';
import { ApplyTemplateUpdateDto } from './dto/apply-template-update.dto';

@ApiTags('template-updates')
@ApiBearerAuth()
@Controller('organizations')
export class TemplateUpdatesController {
  constructor(
    private readonly sectionsService: SectionsService,
    private readonly templatesService: TemplatesService,
  ) {}

  // =========================================================
  // LIST AVAILABLE UPDATES
  // =========================================================

  @Get(':orgId/events/:eventId/template-updates')
  @UseGuards(
    JwtAuthGuard,
    TenantContextGuard,
    PermissionsGuard,
  )
  @RequirePermission(Permission.EVENT_EDIT)
  @ApiOperation({
    summary:
      'List event sections that have newer template versions available',
  })
  listUpdates(
    @Param('orgId') orgId: string,
    @Param('eventId') eventId: string,
  ) {
    return this.sectionsService.listAvailableUpdates(
      eventId,
      orgId,
      this.templatesService,
    );
  }

  // =========================================================
  // APPLY UPDATE
  // =========================================================

  @Post(':orgId/sections/:id/apply-template-update')
  @UseGuards(
    JwtAuthGuard,
    TenantContextGuard,
    PermissionsGuard,
  )
  @RequirePermission(Permission.EVENT_EDIT)
  @ApiOperation({
    summary:
      'Apply the latest template version to a section',
  })
  applyUpdate(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto?: ApplyTemplateUpdateDto,
  ) {
    return this.sectionsService.applyTemplateUpdate(
      id,
      orgId,
      this.templatesService,
      { force: dto?.force === true },
    );
  }
}