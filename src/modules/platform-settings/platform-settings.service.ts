import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PlatformSetting, PlatformSettingDocument } from './schemas/platform-setting.schema';

@Injectable()
export class PlatformSettingsService {
  constructor(@InjectModel(PlatformSetting.name) private model: Model<PlatformSettingDocument>) {}

  async get(key: string) {
    const doc = await this.model.findOne({ key }).exec();
    return doc?.value ?? {};
  }
  async set(key: string, value: Record<string, any>) {
    return this.model.findOneAndUpdate({ key }, { value }, { upsert: true, new: true }).exec();
  }
}