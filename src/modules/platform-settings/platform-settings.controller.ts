import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { PlatformSettingsService } from './platform-settings.service';

@ApiTags('platform-settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller('platform/settings')
export class PlatformSettingsController {
  constructor(private settingsService: PlatformSettingsService) {}

  @Get(':key')
  get(@Param('key') key: string) { return this.settingsService.get(key); }

  @Put(':key')
  set(@Param('key') key: string, @Body() value: Record<string, any>) { return this.settingsService.set(key, value); }
}