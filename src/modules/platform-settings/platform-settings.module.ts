import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlatformSetting, PlatformSettingSchema } from './schemas/platform-setting.schema';
import { PlatformSettingsService } from './platform-settings.service';
import { PlatformSettingsController } from './platform-settings.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: PlatformSetting.name, schema: PlatformSettingSchema }])],
  providers: [PlatformSettingsService],
  controllers: [PlatformSettingsController],
})
export class PlatformSettingsModule {}