import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile as UploadedFileDecorator,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantContextGuard } from '../tenancy/members/guards/tenant-context.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../../common/constants/permissions.constants';
import { MediaService } from './media.service';
import type { UploadedFile } from '../../common/types/uploaded-file.type';

@ApiTags('media')
@Controller('organizations/:orgId') // Scopes the entire controller to /api/v1/organizations/:orgId
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get('events/:eventId/media')
  @ApiOperation({ summary: 'List media for an event' })
  list(@Param('orgId') orgId: string, @Param('eventId') eventId: string) {
    return this.mediaService.listForEvent(orgId, eventId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
  @RequirePermission(Permission.EVENT_EDIT)
  @Post('events/:eventId/media') // Results in: /api/v1/organizations/:orgId/events/:eventId/media
  @ApiOperation({ summary: 'Upload an image/video for an event' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('orgId') orgId: string,
    @Param('eventId') eventId: string,
    @UploadedFileDecorator() file: UploadedFile,
  ) {
    return this.mediaService.upload(orgId, eventId, file);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
  @RequirePermission(Permission.EVENT_EDIT)
  @Post('media') // Results in: /api/v1/organizations/:orgId/media (org-level/logo uploads)
  @ApiOperation({ summary: 'Upload media not tied to a specific event (e.g. team/organization logos)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file'))
  uploadOrgLevel(
    @Param('orgId') orgId: string,
    @UploadedFileDecorator() file: UploadedFile,
  ) {
    return this.mediaService.uploadOrgLevel(orgId, file);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
  @RequirePermission(Permission.EVENT_EDIT)
  @Delete('media/:id') // Results in: /api/v1/organizations/:orgId/media/:id
  @ApiOperation({ summary: 'Remove a media asset' })
  remove(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.mediaService.remove(orgId, id);
  }
}