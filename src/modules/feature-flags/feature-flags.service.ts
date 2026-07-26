import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FeatureFlag, FeatureFlagDocument } from './schemas/feature-flag.schema';

@Injectable()
export class FeatureFlagsService {
  constructor(@InjectModel(FeatureFlag.name) private model: Model<FeatureFlagDocument>) {}

  async isEnabled(key: string, organizationId?: string): Promise<boolean> {
    if (organizationId) {
      const orgFlag = await this.model.findOne({ key, organizationId }).exec();
      if (orgFlag) return orgFlag.enabled;
    }
    const globalFlag = await this.model.findOne({ key, organizationId: null }).exec();
    return globalFlag?.enabled ?? false;
  }

  async setFlag(key: string, enabled: boolean, organizationId: string | null = null, description?: string) {
    return this.model
      .findOneAndUpdate(
        { key, organizationId },
        { enabled, description },
        { upsert: true, new: true },
      )
      .exec();
  }

  list(organizationId: string | null = null) {
    return this.model.find({ organizationId }).exec();
  }
}